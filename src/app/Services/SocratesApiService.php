<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Exception;
use \InvalidArgumentException;

class SocratesApiService
{
    private $baseUrls;
    private $apiKey;
    private $token;
    private $currentUrl;
    private $sessionCookies = [];
    private $docTemplates = [
        'COMINT' => 'Comunicacion interna.docx',
        'MEM' => 'Comunicacion memorandum.docx'
    ];
    private $sgaConfig = null;
    private $docConfig = null;
    private $currentCarreraSlug = 'default';

    public function __construct()
    {
        // URLs base del SGA desde dentro del container Docker para cada carrera
        // Usamos el proxy nginx configurado en el servidor
        // Las rutas /sga-electricidad/ y /sga-mecanica/ están configuradas como proxy en nginx
        // Asegurarnos de que todas las URLs terminen con /
        $this->baseUrls = [
            'mecanica' => rtrim(env('SGA_MECANICA_URL', 'http://host.docker.internal/sgamea/'), '/') . '/',
            'electricidad' => rtrim(env('SGA_ELECTRICIDAD_URL', 'http://host.docker.internal/sga/'), '/') . '/', 
            'default' => rtrim(env('SGA_API_URL', 'http://host.docker.internal/sgamea/'), '/') . '/',
        ];
        
        // URL por defecto
        $this->currentUrl = $this->resolveBaseUrlForSlug('default');
        $this->currentCarreraSlug = 'default';
        $this->apiKey = env('SGA_API_KEY', 'SOCRATES_SGA_API_KEY_2025');
        
        // Registrar las URLs configuradas para debugging
        Log::info('URLs del SGA configuradas', [
            'mecanica' => $this->baseUrls['mecanica'],
            'electricidad' => $this->baseUrls['electricidad'],
            'default' => $this->baseUrls['default'],
            'current' => $this->currentUrl
        ]);
    }

    private function normalizeDocenteCiKey(array $doc): ?string
    {
        $ciRaw = $doc['ci'] ?? $doc['cedula'] ?? $doc['ci_docente'] ?? $doc['cedula_doc'] ?? null;
        if ($ciRaw === null) {
            return null;
        }

        $ci = trim((string) $ciRaw);
        if ($ci === '') {
            return null;
        }

        $digits = preg_replace('/[^0-9]/', '', $ci);
        if ($digits !== '') {
            return $digits;
        }

        return mb_strtoupper($ci);
    }

    private function normalizeDocenteNameKey(array $doc): ?string
    {
        $nombre = trim((string) ($doc['nombre'] ?? $doc['nombres'] ?? ''));
        $apPat = trim((string) ($doc['apellido_p'] ?? $doc['ap_paterno'] ?? $doc['apellidos'] ?? ''));
        $apMat = trim((string) ($doc['apellido_m'] ?? $doc['ap_materno'] ?? ''));

        $full = trim($nombre . ' ' . $apPat . ' ' . $apMat);
        if ($full === '') {
            return null;
        }

        $normalized = 
            Str::of($full)
                ->lower()
                ->replaceMatches('/\s+/', ' ')
                ->replaceMatches('/[^a-zñáéíóú\s]/u', '')
                ->trim()
                ->__toString();

        return $normalized !== '' ? $normalized : null;
    }

    private function mergeDocenteData(array $base, array $incoming): array
    {
        $preferred = function ($primary, $fallback) {
            if ($primary !== null && $primary !== '') {
                return $primary;
            }
            return $fallback;
        };

        $result = $base;
        $fields = [
            'nombre', 'nombres', 'apellido_p', 'apellido_m',
            'ap_paterno', 'ap_materno', 'apellidos', 'ci',
            'celular', 'telefono', 'profesion', 'titulo_academico',
            'pertinencia', 'pertinencia_acad_id'
        ];

        foreach ($fields as $field) {
            $result[$field] = $preferred($result[$field] ?? null, $incoming[$field] ?? null);
        }

        $result['carreras'] = array_values(array_unique(array_merge(
            $result['carreras'] ?? [],
            $incoming['carreras'] ?? []
        )));

        return $result;
    }

    private function formatCarreraCodeFromSlugs(array $slugs): ?string
    {
        $normalized = array_map(function ($slug) {
            $s = strtolower((string) $slug);
            if (Str::contains($s, 'mec')) {
                return 'MEA';
            }
            if (Str::contains($s, 'elec')) {
                return 'EEA';
            }
            return null;
        }, $slugs);

        $normalized = array_values(array_filter(array_unique($normalized)));
        if (!$normalized) {
            return null;
        }

        if (count($normalized) > 1) {
            sort($normalized);
            return 'EEA/MEA';
        }

        return $normalized[0];
    }

    private function normalizeHeaderText($text): string
    {
        $ascii = Str::ascii((string) $text);
        $lower = strtolower($ascii);
        $normalized = preg_replace('/[^a-z0-9]+/', ' ', $lower);
        if ($normalized === null) {
            $normalized = $lower;
        }
        return trim($normalized);
    }

    private function findHeaderIndex(array $normalizedHeaders, array $candidates): ?int
    {
        foreach ($normalizedHeaders as $index => $header) {
            if ($header === '') {
                continue;
            }
            foreach ($candidates as $needle) {
                $needle = trim((string) $needle);
                if ($needle === '') {
                    continue;
                }
                $length = strlen($needle);
                if ($header === $needle) {
                    return $index;
                }
                if ($length >= 3 && Str::contains($header, $needle)) {
                    return $index;
                }
            }
        }
        return null;
    }

    private function loadDocConfig()
    {
        if ($this->docConfig !== null) {
            return;
        }

        $this->docConfig = [];
        $config = $this->getSgaConfig();

        if ($config && isset($config->doc_config) && trim((string) $config->doc_config) !== '') {
            $decoded = json_decode($config->doc_config, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                Log::warning('SGA doc_config inválido, se ignorará', [
                    'error' => json_last_error_msg(),
                ]);
                return;
            }

            foreach ($decoded as $slug => $settings) {
                if (!is_array($settings)) {
                    continue;
                }

                $normalizedSlug = $this->normalizeCarreraSlug($slug);
                $this->docConfig[$normalizedSlug] = array_change_key_case($settings, CASE_LOWER);
            }
        }
    }

    private function getDocConfigSettings($slug)
    {
        $this->loadDocConfig();

        if (isset($this->docConfig[$slug])) {
            return $this->docConfig[$slug];
        }

        if ($slug === 'default' && isset($this->docConfig['default'])) {
            return $this->docConfig['default'];
        }

        return [];
    }

    private function resolveBaseUrlForSlug($slug)
    {
        $this->loadDocConfig();

        if (isset($this->docConfig[$slug]['base_url'])) {
            $candidate = trim((string) $this->docConfig[$slug]['base_url']);
            if ($candidate !== '') {
                return rtrim($candidate, '/') . '/';
            }
        }

        if (isset($this->baseUrls[$slug])) {
            return $this->baseUrls[$slug];
        }

        return $this->baseUrls['default'];
    }

    /**
     * @param string|null $slug
     * @return string
     */
    public function resolveTargetCarreraSlug($slug)
    {
        $normalized = $this->normalizeCarreraSlug($slug ?: 'default');
        $settings = $this->getDocConfigSettings($normalized);

        if (isset($settings['target']) && is_array($settings['target'])) {
            $target = array_change_key_case($settings['target'], CASE_LOWER);
            if (!empty($target['slug'])) {
                return $this->normalizeCarreraSlug($target['slug']);
            }
        }

        if (!empty($settings['target_slug'])) {
            return $this->normalizeCarreraSlug($settings['target_slug']);
        }

        return $normalized;
    }

    /**
     * @param string|null $slug
     * @return string
     */
    public function resolveContextCarreraSlug($slug)
    {
        $normalized = $this->normalizeCarreraSlug($slug ?: 'default');
        $settings = $this->getDocConfigSettings($normalized);

        if (isset($settings['context']) && is_array($settings['context'])) {
            $context = array_change_key_case($settings['context'], CASE_LOWER);
            if (!empty($context['slug'])) {
                return $this->normalizeCarreraSlug($context['slug']);
            }
        }

        if (!empty($settings['context_slug'])) {
            return $this->normalizeCarreraSlug($settings['context_slug']);
        }

        return $normalized;
    }

    private function extractConfiguredParams($settings, $section = null)
    {
        $allowedKeys = ['cod_pensum', 'gestion', 'cod_carrera', 'cod_grupo'];
        $source = $settings;

        if ($section !== null && isset($settings[$section]) && is_array($settings[$section])) {
            $source = array_change_key_case($settings[$section], CASE_LOWER);
        }

        $result = [];
        foreach ($allowedKeys as $key) {
            if (isset($source[$key]) && $source[$key] !== '') {
                $result[$key] = $source[$key];
            }
        }

        return $result;
    }

    private function collectExplicitEmptyKeys($settings, $section = null)
    {
        $allowedKeys = ['cod_pensum', 'gestion', 'cod_carrera', 'cod_grupo'];
        $source = $settings;

        if ($section !== null && isset($settings[$section]) && is_array($settings[$section])) {
            $source = array_change_key_case($settings[$section], CASE_LOWER);
        }

        $empties = [];
        foreach ($allowedKeys as $key) {
            if (array_key_exists($key, $source)) {
                $value = $source[$key];
                if ($value === null || (is_string($value) && trim($value) === '')) {
                    $empties[$key] = true;
                }
            }
        }

        return $empties;
    }

    private function normalizeCarreraSlug($value)
    {
        $slug = strtolower(trim((string) $value));

        if ($slug === '' || $slug === null) {
            return 'default';
        }

        // Detección por substrings primero (más robusto contra nombres descriptivos)
        // Preferir 'electricidad' si aparece "elect" aunque también exista "automotriz"
        if (strpos($slug, 'elect') !== false || strpos($slug, 'eea') !== false) {
            return 'electricidad';
        }
        if (strpos($slug, 'mec') !== false || strpos($slug, 'automotriz') !== false || strpos($slug, 'mea') !== false) {
            return 'mecanica';
        }

        // Fallback a coincidencias exactas conocidas
        if (in_array($slug, ['mecanica', 'mecánica', 'automotriz', 'mea'], true)) {
            return 'mecanica';
        }
        if (in_array($slug, ['electricidad', 'electrónica', 'electronica', 'eea'], true)) {
            return 'electricidad';
        }

        return 'default';
    }

    private function normalizeCarreraCodigoFromName($name)
    {
        if (!$name) {
            return null;
        }

        $normalized = mb_strtolower(trim($name), 'UTF-8');
        if ($normalized === '') {
            return null;
        }

        if (strpos($normalized, 'mec') !== false) {
            return 'MEA';
        }

        if (strpos($normalized, 'elect') !== false) {
            return 'EEA';
        }

        $exact = DB::table('carrera')
            ->whereRaw('LOWER(nombre_carrera) = ?', [$normalized])
            ->value('cod_carrera');

        if ($exact) {
            return $exact;
        }

        $like = DB::table('carrera')
            ->where('nombre_carrera', 'LIKE', '%' . $name . '%')
            ->value('cod_carrera');

        return $like ?: null;
    }

    private function mapCarreraSlugFromCodigo($code)
    {
        if (!$code) {
            return null;
        }

        $upper = strtoupper(trim($code));
        if ($upper === 'MEA') {
            return 'mecanica';
        }
        if ($upper === 'EEA') {
            return 'electricidad';
        }

        return null;
    }

    private function loadSgaConfig()
    {
        if ($this->sgaConfig !== null) {
            return;
        }

        try {
            $config = DB::table('sga_config')->orderBy('id', 'desc')->first();
        } catch (\Throwable $e) {
            Log::warning('No se pudo cargar configuración SGA', ['error' => $e->getMessage()]);
            $config = null;
        }

        $this->sgaConfig = $config ?: false;
    }

    public function getSgaConfig()
    {
        $this->loadSgaConfig();
        return $this->sgaConfig;
    }

    private function getConfigValue($key, $default = null)
    {
        $config = $this->getSgaConfig();
        if ($config && isset($config->$key) && $config->$key !== '') {
            return $config->$key;
        }
        return $default;
    }

    public function getAbreviaturaBase()
    {
        $base = $this->getConfigValue('abreviatura', 'CETA/DA/');
        return rtrim($base, '/') . '/';
    }
    
    /**
     * Establecer la carrera para determinar la URL a usar
     */
    public function setCarrera($carrera)
    {
        $slug = $this->normalizeCarreraSlug($carrera);
        $this->currentUrl = $this->resolveBaseUrlForSlug($slug);
        $this->currentCarreraSlug = $slug;

        return $slug !== 'default';
    }
    
    /**
     * Obtener las URLs disponibles para las diferentes carreras
     * @return array
     */
    public function getAvailableUrls()
    {
        return $this->baseUrls;
    }
    
    /**
     * Obtener la URL actual configurada
     * @return string
     */
    public function getCurrentUrl()
    {
        return $this->currentUrl;
    }

    /**
     * Autenticar con el SGA
     */
    public function authenticate($username, $password)
    {
        try {
            $response = Http::post($this->currentUrl . '/api/socrates/authenticate', [
                'username' => $username,
                'password' => $password
            ]);

            if ($response->successful()) {
                $data = $response->json();
                if ($data['success']) {
                    $this->token = $data['token'];
                    return $data;
                }
            }

            Log::error('Error de autenticación SGA', [
                'response' => $response->json(),
                'status' => $response->status()
            ]);

            return null;
        } catch (Exception $e) {
            Log::error('Excepción en autenticación SGA', ['error' => $e->getMessage()]);
            return null;
        }
    }

    public function loginWeb($username, $password)
    {
        $attempts = [
            [
                'endpoint' => 'login/verify',
                'fields' => [
                    'username' => $username,
                    'password' => $password,
                ],
            ],
            [
                'endpoint' => 'login',
                'fields' => [
                    'n_user' => $username,
                    'contrasenia' => $password,
                ],
            ],
            [
                'endpoint' => 'index.php/login/verify',
                'fields' => [
                    'username' => $username,
                    'password' => $password,
                ],
            ],
            [
                'endpoint' => 'index.php/login',
                'fields' => [
                    'n_user' => $username,
                    'contrasenia' => $password,
                ],
            ],
            [
                'endpoint' => 'index.php/main/login/verify',
                'fields' => [
                    'username' => $username,
                    'password' => $password,
                ],
            ],
            [
                'endpoint' => 'index.php/main/login',
                'fields' => [
                    'n_user' => $username,
                    'contrasenia' => $password,
                ],
            ],
        ];

        foreach ($attempts as $attempt) {
            $endpoint = $attempt['endpoint'];
            $url = rtrim($this->currentUrl, '/') . '/' . ltrim($endpoint, '/');
            try {
                $response = Http::asForm()
                    ->withOptions(['allow_redirects' => false])
                    ->post($url, $attempt['fields']);

                if (in_array($response->status(), [302, 303]) && ($response->headers()['Set-Cookie'] ?? null)) {
                    $this->sessionCookies = $response->headers()['Set-Cookie'];
                    Log::info('Login web SGA exitoso', ['endpoint' => $endpoint]);
                    return ['success' => true, 'cookies' => $this->sessionCookies];
                }

                // Si el endpoint existe pero las credenciales fallan, no tiene sentido probar los demás
                if ($response->status() !== 404) {
                    return [
                        'success' => false,
                        'message' => 'Credenciales inválidas o respuesta inesperada',
                        'status' => $response->status(),
                        'endpoint' => $endpoint,
                        'body' => method_exists($response, 'body') ? $response->body() : null,
                    ];
                }
            } catch (\Throwable $e) {
                Log::warning('Error intentando login SGA', [
                    'endpoint' => $endpoint,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return [
            'success' => false,
            'message' => 'No se pudo encontrar un endpoint válido para login/verify',
        ];
    }

    /**
     * Buscar estudiantes por código en el SGA
     */
    public function getEstudiantes($params = [])
    {
        // Ya no necesitamos un tratamiento especial para Electricidad
        // porque estamos usando el proxy Nginx configurado
        
        // Configurar carrera si se especifica (para otras carreras)
        if (isset($params['carrera'])) {
            $this->setCarrera($params['carrera']);
        }
        
        // Búsqueda por código
        if (isset($params['cod_ceta'])) {
            return $this->buscarEstudiantesPorCodigo($params['cod_ceta']);
        }
        
        // Búsqueda por nombre completo
        if (isset($params['nombres']) || isset($params['ap_pat']) || isset($params['ap_mat'])) {
            return $this->buscarEstudiantesPorNombreCompleto(
                $params['nombres'] ? $params['nombres']: '',
                $params['ap_pat'] ? $params['ap_pat'] : '',
                $params['ap_mat'] ? $params['ap_mat'] : ''
            );
        }
        
        return ['success' => false, 'message' => 'Parámetro cod_ceta o nombre requerido'];
    }

    /**
     * Obtener un estudiante por código CETA
     * @param string $codCeta Código del estudiante
     * @param string|null $carrera Carrera para determinar la URL del SGA
     */
    public function getEstudianteByCodigo($codCeta, $carrera = null)
    {
        if ($carrera) {
            $this->setCarrera($carrera);
        }
        
        return $this->buscarEstudiantesPorCodigo($codCeta);
    }

    /**
     * Buscar estudiante por código usando el endpoint real del SGA
     */
    private function buscarEstudiantesPorCodigo($codigo)
    {
        try {
            // Verificar que tenemos una URL configurada
            $carrera = array_search($this->currentUrl, $this->baseUrls);
            if ($carrera === false || $carrera === null) { $carrera = 'unknown'; }
            Log::info('URL actual para buscar estudiante por código', [ 'carrera' => $carrera, 'url' => $this->currentUrl ]);

            // Variantes de endpoints que algunos SGA exponen (con/sin index.php y con nombre legacy)
            $candidateEndpoints = [
                'index.php/titulacion/serviciostitulacion/buscar_estudiantes_por_cod',
                'titulacion/serviciostitulacion/buscar_estudiantes_por_cod',
                'index.php/titulacion/serviciostitulacion/buscar_estudiantes',
                'titulacion/serviciostitulacion/buscar_estudiantes',
            ];

            // Variantes de parámetros aceptados por distintos despliegues del SGA
            $paramVariants = [
                [ 'cod_ceta' => $codigo, 'codigo' => $codigo, 'cod_estudiante' => $codigo, 'estudiante' => $codigo ],
                [ 'criterio' => 'codigo', 'cod_ceta' => $codigo, 'codigo' => $codigo ],
            ];

            // Cliente y headers comunes
            $cookieHeader = '';
            if (!empty($this->sessionCookies)) {
                $cookieHeader = implode('; ', array_map(function ($cookieLine) { return explode(';', $cookieLine)[0]; }, $this->sessionCookies));
            }
            $slug = $this->currentCarreraSlug ?: 'default';
            $baseForSlug = isset($this->baseUrls[$slug]) ? $this->baseUrls[$slug] : $this->currentUrl;

            Log::info('Base URL seleccionada para búsqueda por código', [ 'slug' => $slug, 'base' => $baseForSlug, 'current' => $this->currentUrl ]);

            $commonHeaders = [ 'Referer' => rtrim($baseForSlug, '/') . '/titulacion/serviciostitulacion' ];
            if ($cookieHeader !== '') { $commonHeaders['Cookie'] = $cookieHeader; }

            foreach ($candidateEndpoints as $endpoint) {
                $requestUrl = rtrim($baseForSlug, '/') . '/' . ltrim($endpoint, '/');
                foreach ($paramVariants as $params) {
                    Log::info('Intento búsqueda por código (POST)', [ 'url' => $requestUrl, 'params' => $params ]);
                    $response = Http::asForm()
                        ->timeout(15)
                        ->withOptions([ 'allow_redirects' => true, 'http_errors' => false, 'connect_timeout' => 5 ])
                        ->withHeaders($commonHeaders)
                        ->post($requestUrl, $params);

                    if ($response->successful()) {
                        $html = $response->body();
                        if (stripos($html, 'PHP Error') !== false || stripos($html, 'Fatal error') !== false) {
                            Log::warning('SGA devolvió errores PHP (POST)', [ 'endpoint' => $endpoint ]);
                        } else {
                            $estudiantes = $this->parseEstudiantesHtml($html);
                            if (!empty($estudiantes)) {
                                return [ 'success' => true, 'data' => $estudiantes ];
                            }
                        }
                    } elseif (in_array($response->status(), [301, 302])) {
                        $redirectUrl = $response->header('Location');
                        if ($redirectUrl) {
                            Log::info('Siguiendo redirección (POST)', [ 'to' => $redirectUrl ]);
                            $redir = Http::asForm()->timeout(15)->withOptions([ 'allow_redirects' => true, 'http_errors' => false ])->post($redirectUrl, $params);
                            if ($redir->successful()) {
                                $estudiantes = $this->parseEstudiantesHtml($redir->body());
                                if (!empty($estudiantes)) { return [ 'success' => true, 'data' => $estudiantes ]; }
                            }
                        }
                    }

                    // Fallback GET
                    Log::info('Intento búsqueda por código (GET)', [ 'url' => $requestUrl, 'params' => $params ]);
                    $getResp = Http::timeout(15)
                        ->withOptions([ 'allow_redirects' => true, 'http_errors' => false, 'connect_timeout' => 5 ])
                        ->withHeaders($commonHeaders)
                        ->get($requestUrl, $params);
                    if ($getResp->successful()) {
                        $html = $getResp->body();
                        if (stripos($html, 'PHP Error') !== false || stripos($html, 'Fatal error') !== false) {
                            Log::warning('SGA devolvió errores PHP (GET)', [ 'endpoint' => $endpoint ]);
                        } else {
                            $estudiantes = $this->parseEstudiantesHtml($html);
                            if (!empty($estudiantes)) {
                                return [ 'success' => true, 'data' => $estudiantes ];
                            }
                        }
                    }
                }
            }

            // Si llegamos aquí, no hubo resultados aunque hubo intentos válidos
            Log::warning('No se encontraron estudiantes por código tras probar endpoints', [ 'codigo' => $codigo ]);
            return [ 'success' => true, 'data' => [] ];
        } catch (\Exception $e) {
            Log::error('Error en buscarEstudiantesPorCodigo', [ 'error' => $e->getMessage(), 'codigo' => $codigo ]);
            return [ 'success' => false, 'message' => 'Error de conexión: ' . $e->getMessage() ];
        }
    }

    public function fetchCorrelativoContext($codCeta, $carrera = null)
    {
        $codCeta = trim((string)$codCeta);
        if ($codCeta === '') {
            return [
                'success' => false,
                'message' => 'cod_ceta requerido'
            ];
        }

        if ($carrera) {
            $this->setCarrera($carrera);
        }

        $sessionResult = $this->ensureWebSession();
        if (empty($sessionResult['success'])) {
            return [
                'success' => false,
                'message' => $sessionResult['message'] ?? 'No se pudo iniciar sesión en el SGA'
            ];
        }

        $result = $this->buscarEstudiantesPorCodigo($codCeta);
        if (empty($result['success']) || empty($result['data'])) {
            return [
                'success' => false,
                'message' => $result['message'] ?? 'No se encontraron datos en el SGA'
            ];
        }

        $rows = $result['data'];
        $matched = null;
        foreach ($rows as $row) {
            $candidate = isset($row['cod_ceta']) ? trim((string)$row['cod_ceta']) : '';
            if ($candidate !== '' && $candidate === $codCeta) {
                $matched = $row;
                break;
            }
        }

        if ($matched === null) {
            $matched = $rows[0];
        }

        $context = [
            'cod_ceta' => isset($matched['cod_ceta']) ? trim((string)$matched['cod_ceta']) : $codCeta,
        ];

        if (!empty($matched['pensum'])) {
            $context['cod_pensum'] = trim($matched['pensum']);
        }

        if (!empty($matched['carrera'])) {
            $context['carrera_nombre'] = trim($matched['carrera']);
            $code = $this->normalizeCarreraCodigoFromName($matched['carrera']);
            if ($code) {
                $context['cod_carrera'] = $code;
                $slug = $this->mapCarreraSlugFromCodigo($code);
                if ($slug) {
                    $context['carrera_slug'] = $slug;
                }
            }
        }

        if (empty($context['gestion']) && isset($matched['raw']) && is_array($matched['raw'])) {
            foreach ($matched['raw'] as $key => $value) {
                $normKey = mb_strtolower((string)$key, 'UTF-8');
                if (strpos($normKey, 'gest') !== false) {
                    $candidate = trim((string)$value);
                    if ($candidate !== '') {
                        $context['gestion'] = $candidate;
                        break;
                    }
                }
            }
        }

        return [
            'success' => true,
            'data' => $context
        ];
    }

    /**
     * Buscar estudiantes por nombre completo (nombres, apellido paterno y materno)
     */
    public function buscarEstudiantesPorNombre($nombres = '', $apPat = '', $apMat = '', $limit = 100, $offset = 0, $carrera = null)
    {
        // Validar que la carrera sea obligatoria
        if (empty($carrera)) {
            throw new InvalidArgumentException("El parámetro 'carrera' es requerido");
        }

        // Validar que al menos un campo de nombre esté presente
        if (empty($nombres) && empty($apPat) && empty($apMat)) {
            return array(
                'success' => false,
                'message' => 'Debe proporcionar al menos un criterio (nombres, ap_pat o ap_mat)'
            );
        }

        // Configurar carrera (obligatorio)
        $this->setCarrera($carrera);

        try {
            // Parámetros según la estructura del SGA original
            // El código original usa $_POST['nombres'], $_POST['ap_pat'], $_POST['ap_mat']
            // Y verifica if($criterio=='nombre'), por lo que necesitamos incluir este parámetro
            $params = array(
                'criterio' => 'nombre',
                'nombres' => isset($nombres) ? $nombres : '',
                'ap_pat' => isset($apPat) ? $apPat : '',
                'ap_mat' => isset($apMat) ? $apMat : ''
            );
            
            // Registrar los parámetros que estamos enviando
            Log::info('Parámetros enviados para búsqueda por nombre', $params);

            // Seleccionar base según carrera actual (evitar depender solo de currentUrl)
            $slug = $this->currentCarreraSlug ?: 'default';
            $baseForSlug = isset($this->baseUrls[$slug]) ? $this->baseUrls[$slug] : $this->currentUrl;

            Log::info('Base URL seleccionada para búsqueda por nombre', [ 'slug' => $slug, 'base' => $baseForSlug, 'current' => $this->currentUrl ]);

            $requestUrl = rtrim($baseForSlug, '/') . '/titulacion/serviciostitulacion/buscar_estudiantes/nombre';

            Log::info('Enviando request al SGA para búsqueda por nombre', [
                'url' => $requestUrl,
                'params' => $params
            ]);

            // Intentar con cURL directamente para tener más control
            $ch = curl_init($requestUrl);
            
            // Enviar los datos POST directamente como array
            // cURL codificará correctamente los datos como multipart/form-data
            
            // Opciones de cURL
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            // No establecer Content-Type, cURL lo configurará automáticamente
            // al enviar un array en POSTFIELDS
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Accept: text/html,application/xhtml+xml'
            ]);
            
            // Asegurar que se use la codificación correcta
            curl_setopt($ch, CURLOPT_ENCODING, '');
            
            // Ejecutar la petición
            $rawResponse = curl_exec($ch);
            $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);
            
            // Guardar la respuesta cruda para debug
            Log::debug('Respuesta raw del SGA (cURL):', [
                'status' => $statusCode,
                'error' => $error,
                'body' => $rawResponse
            ]);
            
            // Crear un objeto similar al que devuelve Http facade
            $response = new \Illuminate\Http\Client\Response(
                new \GuzzleHttp\Psr7\Response($statusCode, [], $rawResponse)
            );
            
            Log::info('Respuesta del SGA búsqueda por nombre', [
                'status' => $response->status(),
                'headers' => $response->headers(),
                'body_preview' => substr($response->body(), 0, 500)
            ]);
            
            if ($response->successful()) {
                $html = $response->body();
                
                if (strpos($html, 'PHP Error') !== false || strpos($html, 'Fatal error') !== false) {
                    Log::warning('SGA devuelve errores PHP en búsqueda por nombre', [
                        'params' => $params,
                        'errors' => substr($html, 0, 1000)
                    ]);
                    return ['success' => false, 'message' => 'Error interno del SGA'];
                }
                
                $estudiantes = $this->parseEstudiantesHtml($html);
                
                return [
                    'success' => true,
                    'data' => array_slice($estudiantes, $offset, $limit),
                    'total' => count($estudiantes),
                    'carrera' => $carrera,
                    'params' => $params
                ];
            }

            // Si el código es 301 o 302, probablemente se debe a un problema de redirección
            if ($response->status() == 301 || $response->status() == 302) {
                $redirectUrl = $response->header('Location');
                Log::warning('SGA intentó redireccionar en búsqueda por nombre', [
                    'status' => $response->status(),
                    'redirect_to' => $redirectUrl
                ]);
                
                // Intentar seguir la redirección manualmente
                if ($redirectUrl) {
                    Log::info('Siguiendo redirección manualmente', ['url' => $redirectUrl]);
                    $response = Http::asForm()->timeout(15)->post($redirectUrl, $params);
                    
                    if ($response->successful()) {
                        $html = $response->body();
                        $estudiantes = $this->parseEstudiantesHtml($html);
                        
                        return [
                            'success' => true,
                            'data' => array_slice($estudiantes, $offset, $limit),
                            'total' => count($estudiantes),
                            'carrera' => $carrera
                        ];
                    }
                }
            }

            Log::error('Error en búsqueda por nombre completo', [
                'params' => $params,
                'status' => $response->status(),
                'response_body' => substr($response->body(), 0, 500)
            ]);
            
            return ['success' => false, 'message' => 'Error en la consulta al SGA: ' . $response->status()];

        } catch (\Exception $e) {
            Log::error('Excepción en búsqueda por nombre SGA', [
                'error' => $e->getMessage(),
                'trace' => $e->getTrace(),
                'nombres' => $nombres,
                'ap_pat' => $apPat,
                'ap_mat' => $apMat
            ]);
            
            return ['success' => false, 'message' => 'Error de conexión: ' . $e->getMessage()];
        }
    }

    /**
     * Obtener carreras activas
     */
    public function getCarreras()
    {
        return $this->makeApiRequest('GET', '/api/socrates/carreras');
    }

    /**s
     * Obtener gestiones activas
     */
    public function getGestiones()
    {
        return $this->makeApiRequest('GET', '/api/socrates/gestiones');
    }

    /**
     * Obtener inscripciones de un estudiante
     */
    public function getInscripciones($codCeta)
    {
        return $this->makeApiRequest('GET', '/api/socrates/inscripciones', ['cod_ceta' => $codCeta]);
    }

    /**
     * Obtener docentes activos del SGA (legacy)
     *
     * Cuando $carrera es null, se consultan ambas carreras y se unifican resultados
     * por CI/nombre, agregando la etiqueta EEA/MEA según corresponda.
     *
     * @param string|null $carrera
     * @return array
     */
    public function getDocentes($carrera = null)
    {
        if ($carrera) {
            $this->setCarrera($carrera);
            return $this->buscarDocentesLegacy();
        }

        $slugs = ['mecanica', 'electricidad'];
        $aggregated = [];
        $nameIndex = [];

        $previousUrl = $this->currentUrl;
        $previousSlug = $this->currentCarreraSlug;

        foreach ($slugs as $slug) {
            $normalizedSlug = $this->normalizeCarreraSlug($slug);
            $forcedUrl = $this->baseUrls[$normalizedSlug] ?? $this->baseUrls['default'];
            $this->currentUrl = $forcedUrl;
            $this->currentCarreraSlug = $normalizedSlug;
            $result = $this->buscarDocentesLegacy();
            if (!is_array($result) || empty($result['success'])) {
                continue;
            }

            $docs = isset($result['data']) && is_array($result['data']) ? $result['data'] : [];
            Log::info('Docentes SGA parseados', [
                'slug' => $slug,
                'current_url' => $this->currentUrl,
                'total' => count($docs),
            ]);
            foreach ($docs as $doc) {
                if (!is_array($doc)) {
                    continue;
                }

                $fullAscii = Str::upper(Str::ascii(trim(($doc['nombre'] ?? '') . ' ' . ($doc['apellido_p'] ?? '') . ' ' . ($doc['apellido_m'] ?? ''))));
                if (Str::contains($fullAscii, 'CASTANETA')) {
                    Log::info('Docente Pedro detectado en slug', [
                        'slug' => $slug,
                        'doc' => $doc,
                    ]);
                }

                $ciKey = $this->normalizeDocenteCiKey($doc);
                $nameKey = $this->normalizeDocenteNameKey($doc);

                if ($ciKey === null && $nameKey === null) {
                    continue;
                }

                $aggregateKey = $ciKey ?? ('name:' . $nameKey);

                if (!isset($aggregated[$aggregateKey])) {
                    $aggregated[$aggregateKey] = $doc;
                    $aggregated[$aggregateKey]['carreras'] = [];
                } else {
                    $aggregated[$aggregateKey] = $this->mergeDocenteData($aggregated[$aggregateKey], $doc);
                }

                $aggregated[$aggregateKey]['carreras'][] = $slug;
                $aggregated[$aggregateKey]['carreras'] = array_values(array_unique($aggregated[$aggregateKey]['carreras']));
                $carreraCode = $this->formatCarreraCodeFromSlugs($aggregated[$aggregateKey]['carreras']);
                $aggregated[$aggregateKey]['cod_carrera'] = $carreraCode;
                $aggregated[$aggregateKey]['carrera_label'] = $carreraCode;

                if ($ciKey !== null) {
                    $nameIndex[$nameKey] = $aggregateKey;
                } elseif ($nameKey !== null && isset($nameIndex[$nameKey])) {
                    $aggregated[$nameIndex[$nameKey]] = $this->mergeDocenteData($aggregated[$nameIndex[$nameKey]], $aggregated[$aggregateKey]);
                    unset($aggregated[$aggregateKey]);
                }
            }
        }

        // Restaurar URL por defecto
        $this->currentUrl = $previousUrl;
        $this->currentCarreraSlug = $previousSlug;

        $summary = [
            'MEA' => 0,
            'EEA' => 0,
            'EEA/MEA' => 0,
            'NULL' => 0,
        ];
        $samples = [
            'MEA' => null,
            'EEA' => null,
            'EEA/MEA' => null,
            'NULL' => null,
        ];

        foreach ($aggregated as $item) {
            $code = $item['cod_carrera'] ?? null;
            $key = $code ?: 'NULL';
            if (!isset($summary[$key])) {
                $summary[$key] = 0;
                $samples[$key] = null;
            }
            $summary[$key]++;
            if ($samples[$key] === null) {
                $samples[$key] = array_intersect_key($item, array_flip([
                    'nombre', 'apellido_p', 'apellido_m', 'ci', 'cod_carrera', 'carrera_label', 'carreras'
                ]));
            }
        }

        Log::info('Docentes unificados por carrera', [
            'resumen' => $summary,
            'muestra' => array_filter($samples)
        ]);

        return [
            'success' => true,
            'data' => array_values($aggregated),
        ];
    }

    /**
     * Realizar petición a la API del SGA
     */
    private function makeApiRequest($method, $endpoint, $params = [])
    {
        try {
            $headers = [
                'X-API-Key' => $this->apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ];

            if ($this->token) {
                $headers['Authorization'] = 'Bearer ' . $this->token;
            }

            $response = Http::withHeaders($headers);

            $url = rtrim($this->currentUrl, '/') . '/' . ltrim($endpoint, '/');

            if ($method === 'GET') {
                $response = $response->get($url, $params);
            } else {
                $response = $response->post($url, $params);
            }

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Error en petición API SGA', [
                'endpoint' => $endpoint,
                'params' => $params,
                'response' => $response->json(),
                'status' => $response->status()
            ]);

            return null;
        } catch (Exception $e) {
            Log::error('Excepción en petición API SGA', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Verificar si la conexión al SGA está disponible
     * @param string|null $carrera Carrera para determinar la URL del SGA
     */
    public function checkConnection($carrera = null)
    {
        if ($carrera) {
            $this->setCarrera($carrera);
        }

        try {
            // Verificar acceso a la página principal del SGA
            $response = Http::timeout(5)->get($this->currentUrl . '/index.php/main');
            $status = $response->status();
            
            // 200 = página cargada, 302 = redirección (normal en apps web)
            return in_array($status, [200, 302]);
        } catch (Exception $e) {
            Log::error('Error de conexión al SGA', [
                'url' => $this->currentUrl . '/index.php/main',
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Parsear HTML de estudiantes a array estructurado
     */
    private function parseEstudiantesHtml($html)
    {
        $estudiantes = [];
        if (trim($html) === '') { return $estudiantes; }

        // Log del HTML para debug
        Log::info('HTML recibido del SGA', [
            'html_preview' => substr($html, 0, 2000),
            'html_length' => strlen($html)
        ]);

        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        $dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        $xpath = new \DOMXPath($dom);

        // Buscar todas las tablas
        $tables = $xpath->query('//table');
        Log::info('Tablas encontradas', ['count' => $tables->length]);
        
        foreach ($tables as $tableIndex => $table) {
            $rows = $xpath->query('.//tr', $table);
            Log::info('Procesando tabla', [
                'table_index' => $tableIndex,
                'rows_count' => $rows->length
            ]);
            
            if ($rows->length < 1) { continue; }

            // Buscar encabezados en cualquier fila que tenga th o texto que parezca encabezado
            $headers = [];
            $headerRowIndex = -1;
            
            for ($r = 0; $r < $rows->length; $r++) {
                $headerCells = $xpath->query('.//th', $rows->item($r));
                if ($headerCells->length > 0) {
                    $headerRowIndex = $r;
                    foreach ($headerCells as $cell) {
                        $headers[] = trim($cell->textContent);
                    }
                    break;
                }
                
                // Si no hay th, buscar td que parezcan encabezados
                $cells = $xpath->query('.//td', $rows->item($r));
                if ($cells->length > 0) {
                    $possibleHeaders = [];
                    foreach ($cells as $cell) {
                        $text = trim($cell->textContent);
                        $possibleHeaders[] = $text;
                    }
                    
                    // Si contiene palabras clave de encabezados
                    $headerKeywords = ['Código', 'Nombre', 'Apellido', 'Cédula', 'Procedencia', 'Email', 'Teléfono', 'Celular', 'Telefono', 'Tel.', 'Tel'];
                    $matchCount = 0;
                    foreach ($possibleHeaders as $ph) {
                        foreach ($headerKeywords as $keyword) {
                            if (stripos($ph, $keyword) !== false) {
                                $matchCount++;
                                break;
                            }
                        }
                    }
                    
                    if ($matchCount >= 2) { // Al menos 2 coincidencias
                        $headers = $possibleHeaders;
                        $headerRowIndex = $r;
                        break;
                    }
                }
            }
            
            Log::info('Headers encontrados', [
                'headers' => $headers,
                'header_row_index' => $headerRowIndex
            ]);

            // Procesar filas de datos (después de los headers o desde la segunda fila si no hay headers)
            // La primera fila suele ser la 1 o 2 según la estructura del SGA
            $startRow = ($headerRowIndex > -1) ? $headerRowIndex + 1 : 1;
            
            for ($i = $startRow; $i < $rows->length; $i++) {
                $cells = $xpath->query('.//td', $rows->item($i));
                if ($cells->length === 0) { continue; }

                // Definir nombres de columnas según la estructura del SGA
                $columnNames = [
                    'Nº',
                    'Cod. CETA',
                    'Ap. Paterno',
                    'Ap. Materno',
                    'Nombres',
                    'Carrera',
                    'Pensum',
                    'Fecha de Nacimiento',
                    'Lugar de Nacimiento',
                    'Celular',
                    'Cédula de Identidad',
                    'Procedencia',
                    'N° Serie Titulo de Bachiller'
                ];
                
                $row = [];
                for ($c = 0; $c < $cells->length; $c++) {
                    // Usar el nombre definido o col# como fallback
                    $key = isset($columnNames[$c]) ? $columnNames[$c] : 'col'.($c+1);
                    $value = trim($cells->item($c)->textContent);
                    $row[$key] = $value;
                }
                
                // Log detallado de la estructura de datos
                Log::info('Fila procesada', ['row' => $row, 'keys' => array_keys($row)]);
                
                // Mapeo utilizando los nombres descriptivos de columnas
                $estudiante = [
                    'cod_ceta' => isset($row['Cod. CETA']) ? $row['Cod. CETA'] : '',
                    'ap_pat' => isset($row['Ap. Paterno']) ? $row['Ap. Paterno'] : '',
                    'ap_mat' => isset($row['Ap. Materno']) ? $row['Ap. Materno'] : '',
                    'nombres' => isset($row['Nombres']) ? $row['Nombres'] : '',
                    'carrera' => isset($row['Carrera']) ? $row['Carrera'] : '',
                    'pensum' => isset($row['Pensum']) ? $row['Pensum'] : '',
                    'fecha_nacimiento' => isset($row['Fecha de Nacimiento']) ? $row['Fecha de Nacimiento'] : '',
                    'lugar_nacimiento' => isset($row['Lugar de Nacimiento']) ? $row['Lugar de Nacimiento'] : '',
                    'celular' => isset($row['Celular']) ? $row['Celular'] : '',
                    'ci' => isset($row['Cédula de Identidad']) ? $row['Cédula de Identidad'] : '',
                    'procedencia' => isset($row['Procedencia']) ? $row['Procedencia'] : '',
                    'nro_serie_titulo' => isset($row['N° Serie Titulo de Bachiller']) ? $row['N° Serie Titulo de Bachiller'] : '',
                    'raw' => $row
                ];

                // Filtrar filas que tengan al menos cod_ceta o nombres
                if (!empty($estudiante['cod_ceta']) || !empty($estudiante['nombres'])) {
                    // Filtrar por carrera solicitada (si aplica)
                    // Si no se configuró explícitamente la carrera, intentar derivarla desde la URL actual
                    $slug = $this->currentCarreraSlug ?: (array_search($this->currentUrl, $this->baseUrls) ?: null);
                    $include = true;
                    if ($slug === 'electricidad') {
                        $pensum = strtoupper($estudiante['pensum']);
                        $carTxt = mb_strtolower($estudiante['carrera']);
                        $include = (strpos($pensum, 'EEA') !== false) || (strpos($carTxt, 'elect') !== false);
                    } elseif ($slug === 'mecanica') {
                        $pensum = strtoupper($estudiante['pensum']);
                        $carTxt = mb_strtolower($estudiante['carrera']);
                        $include = (strpos($pensum, 'MEA') !== false) || (strpos($carTxt, 'mec') !== false);
                    }
                    if ($include) {
                        $estudiantes[] = $estudiante;
                    }
                }
            }

            if (!empty($estudiantes)) { 
                Log::info('Estudiantes encontrados', ['count' => count($estudiantes)]);
                break; 
            }
        }

        return $estudiantes;
    }

    /**
     * Parsear HTML de docentes (tabla legacy dataTables-docentes) a array estructurado
     * Retorna elementos con: nombre, apellido_p, apellido_m, ci, profesion, celular, nombre_corto
     */
    private function parseDocentesHtml($html)
    {
        $docentes = [];
        if (trim($html) === '') { return $docentes; }

        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        $dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        $xpath = new \DOMXPath($dom);

        // Intentar por ID específico
        $table = $xpath->query('//table[@id="dataTables-docentes"]')->item(0);
        $tables = [];
        if ($table) { $tables = [$table]; }
        else { $tables = iterator_to_array($xpath->query('//table')); }

        static $headersLogged = false;

        foreach ($tables as $tbl) {
            $rows = $xpath->query('.//tr', $tbl);
            if ($rows->length === 0) { continue; }

            // Detectar encabezados
            $headers = [];
            $normalizedHeaders = [];
            $headerRowIndex = -1;
            for ($r = 0; $r < $rows->length; $r++) {
                $ths = $xpath->query('.//th', $rows->item($r));
                if ($ths->length > 0) {
                    $headerRowIndex = $r;
                    foreach ($ths as $th) {
                        $text = trim($th->textContent);
                        $headers[] = $text;
                        $normalizedHeaders[] = $this->normalizeHeaderText($text);
                    }
                    break;
                }
            }

            if ($headerRowIndex === -1) {
                // Fallback: usar la primera fila como encabezado aproximado
                $firstRowTds = $xpath->query('.//td', $rows->item(0));
                if ($firstRowTds->length > 0) {
                    $headerRowIndex = 0;
                    for ($i = 0; $i < $firstRowTds->length; $i++) {
                        $text = trim($firstRowTds->item($i)->textContent);
                        $headers[] = $text;
                        $normalizedHeaders[] = $this->normalizeHeaderText($text);
                    }
                }
            }

            if (empty($normalizedHeaders)) {
                continue;
            }

            if (!$headersLogged) {
                Log::info('Docentes SGA headers detectados', [
                    'headers' => $headers,
                    'normalized' => $normalizedHeaders,
                ]);
                $headersLogged = true;
            }

            // Validar que parezca la tabla de docentes
            $headerText = strtolower(implode(' ', $headers));
            $looksLike = (strpos($headerText, 'nombres') !== false && strpos($headerText, 'paterno') !== false)
                      || (strpos($headerText, 'cédula') !== false && strpos($headerText, 'ci') !== false)
                      || (strpos($headerText, 'profesion') !== false && strpos($headerText, 'celular') !== false)
                      || (strpos($headerText, 'docente') !== false && strpos($headerText, 'nombre') !== false);
            if (!$looksLike && !$table) { continue; }

            $indexNumero = $this->findHeaderIndex($normalizedHeaders, ['n', 'numero', 'no', 'nro']);
            $indexNombre = $this->findHeaderIndex($normalizedHeaders, ['nombres', 'nombre']);
            $indexApPat = $this->findHeaderIndex($normalizedHeaders, ['ap paterno', 'apellido paterno', 'ap pater', 'ap pater']);
            $indexApMat = $this->findHeaderIndex($normalizedHeaders, ['ap materno', 'apellido materno', 'ap mater']);
            $indexCi = $this->findHeaderIndex($normalizedHeaders, ['cedula', 'ci', 'cedula de identidad', 'c i']);
            $indexProfesion = $this->findHeaderIndex($normalizedHeaders, ['profesion', 'profesion titulo', 'titulo']);
            $indexNombreCorto = $this->findHeaderIndex($normalizedHeaders, ['nombre corto', 'nom corto']);
            $indexCelular = $this->findHeaderIndex($normalizedHeaders, ['celular', 'telefono', 'teléfono', 'telef']);
            $indexCorreo = $this->findHeaderIndex($normalizedHeaders, ['correo', 'email', 'e mail']);
            $indexCarrera = $this->findHeaderIndex($normalizedHeaders, ['carrera']);

            $startRow = ($headerRowIndex > -1) ? $headerRowIndex + 1 : 1;
            $offset = 0;
            if ($rows->length > $startRow) {
                $firstDataCells = $xpath->query('.//td', $rows->item($startRow));
                if ($firstDataCells->length > 0) {
                    $firstCellText = trim($firstDataCells->item(0)->textContent);
                    if ($firstCellText !== '' && preg_match('/^[0-9]+$/', $firstCellText)) {
                        $offset = 1;
                    }
                }
            }

            $fallbackMap = [
                'nombre' => $offset + 0,
                'ap_pat' => $offset + 1,
                'ap_mat' => $offset + 2,
                'ci' => $offset + 3,
                'profesion' => $offset + 4,
                'nombre_corto' => $offset + 5,
                'celular' => $offset + 6,
            ];

            for ($i = $startRow; $i < $rows->length; $i++) {
                $tds = $xpath->query('.//td', $rows->item($i));
                if ($tds->length === 0) { continue; }

                $firstTxt = trim($tds->item(0)->textContent);
                if (stripos($firstTxt, 'No existen datos') !== false) { break; }

                // Determinar si hay columna Nº
                $hasNumero = false;
                foreach ($headers as $h) {
                    $hLower = strtolower($h);
                    if (strpos($hLower, 'nº') !== false || strpos($hLower, 'n°') !== false || strpos($hLower, 'nro') !== false || $hLower === 'n' || $hLower === 'no') {
                        $hasNumero = true; break;
                    }
                }
                $offset = $hasNumero ? 1 : 0;

                if ($tds->length < ($offset + 6)) { continue; }
                $nombre    = trim($tds->item($offset + 0)->textContent);
                $apPat     = trim($tds->item($offset + 1)->textContent);
                $apMat     = trim($tds->item($offset + 2)->textContent);
                $ci        = trim($tds->item($offset + 3)->textContent);
                $profesion = trim($tds->item($offset + 4)->textContent);
                $nombreCorto = trim($tds->item($offset + 5)->textContent);
                $celular   = trim($tds->item($offset + 6)->textContent);

                // Filtrar filas vacías
                if ($nombre === '' && $apPat === '' && $apMat === '' && $ci === '') { continue; }

                $docentes[] = [
                    'nombre' => $nombre,
                    'apellido_p' => $apPat,
                    'apellido_m' => $apMat,
                    'ci' => $ci,
                    'profesion' => $profesion,
                    'nombre_corto' => $nombreCorto,
                    'celular' => $celular,
                ];
            }

            if (!empty($docentes)) { break; }
        }

        return $docentes;
    }

    /**
     * Llamar al endpoint legacy para listar docentes y parsear HTML
     */
    private function buscarDocentesLegacy()
    {
        try {
            $carrera = array_search($this->currentUrl, $this->baseUrls);
            if ($carrera === false || $carrera === null) { $carrera = 'unknown'; }

            $candidateEndpoints = [
                'index.php/titulacion/serviciostitulacion/buscar_docentes',
                'titulacion/serviciostitulacion/buscar_docentes',
            ];

            foreach ($candidateEndpoints as $endpoint) {
                $requestUrl = rtrim($this->currentUrl, '/') . '/' . ltrim($endpoint, '/');
                // 1) Intento POST sin parámetros
                $ch = curl_init($requestUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, []);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 15);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: text/html,application/xhtml+xml']);
                curl_setopt($ch, CURLOPT_ENCODING, '');
                $rawResponse = curl_exec($ch);
                $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $error = curl_error($ch);
                curl_close($ch);

                Log::info('Docentes SGA (POST)', [ 'url' => $requestUrl, 'status' => $statusCode, 'error' => $error, 'body_preview' => $rawResponse ? substr($rawResponse,0,300) : '' ]);

                if ($statusCode >= 200 && $statusCode < 300 && !empty($rawResponse)) {
                    if (strpos($rawResponse, 'PHP Error') !== false || strpos($rawResponse, 'Fatal error') !== false) {
                        Log::warning('SGA devolvió errores PHP en Docentes (POST)', [ 'endpoint' => $endpoint ]);
                    } else {
                        $docentes = $this->parseDocentesHtml($rawResponse);
                        if (!empty($docentes)) {
                            return [ 'success' => true, 'data' => $docentes, 'total' => count($docentes), 'carrera' => $carrera, 'endpoint' => $endpoint, 'method' => 'POST' ];
                        }
                    }
                }

                // 2) Intento GET
                $ch = curl_init($requestUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 15);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: text/html,application/xhtml+xml']);
                curl_setopt($ch, CURLOPT_ENCODING, '');
                $rawResponse = curl_exec($ch);
                $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $error = curl_error($ch);
                curl_close($ch);

                Log::info('Docentes SGA (GET)', [ 'url' => $requestUrl, 'status' => $statusCode, 'error' => $error, 'body_preview' => $rawResponse ? substr($rawResponse,0,300) : '' ]);

                if ($statusCode >= 200 && $statusCode < 300 && !empty($rawResponse)) {
                    if (strpos($rawResponse, 'PHP Error') !== false || strpos($rawResponse, 'Fatal error') !== false) {
                        Log::warning('SGA devolvió errores PHP en Docentes (GET)', [ 'endpoint' => $endpoint ]);
                    } else {
                        $docentes = $this->parseDocentesHtml($rawResponse);
                        if (!empty($docentes)) {
                            return [ 'success' => true, 'data' => $docentes, 'total' => count($docentes), 'carrera' => $carrera, 'endpoint' => $endpoint, 'method' => 'GET' ];
                        }
                    }
                }
            }

            return [ 'success' => false, 'message' => 'No se pudo obtener la lista de docentes desde el SGA' ];
        } catch (\Exception $e) {
            Log::error('Error en buscarDocentesLegacy', [ 'error' => $e->getMessage() ]);
            return [ 'success' => false, 'message' => 'Error de conexión: ' . $e->getMessage() ];
        }
    }
    
    /**
     * Extraer campo de un array usando múltiples posibles claves
     */
    private function extractField($row, $possibleKeys)
    {
        foreach ($possibleKeys as $key) {
            if (isset($row[$key]) && !empty(trim($row[$key]))) {
                return trim($row[$key]);
            }
        }
        return null;
    }

    /**
     * Obtener pagos de Material Extra por código CETA
     * @param string $codCeta
     * @param string|null $carrera
     * @return array
     */
    public function getPagosMaterialExtra($codCeta, $carrera = null)
    {
        if ($carrera) {
            $this->setCarrera($carrera);
        }
        return $this->buscarPagosMaterialExtraPorCodigo($codCeta);
    }

    /**
     * Obtener correlativo de documento desde el SGA usando la función mget_correlativo_abreviatura.
     */
    public function getCorrelativoAbreviatura($abreviatura, $idTipoDocumento, $anio, $carrera = null, array $overrides = [])
    {
        if (!$abreviatura || !$idTipoDocumento || !$anio) {
            return [
                'success' => false,
                'message' => 'Parámetros incompletos para solicitar correlativo',
            ];
        }

        $targetSlug = null;
        if ($carrera) {
            $targetSlug = $this->normalizeCarreraSlug($carrera);
        }

        if (!$targetSlug && isset($overrides['target_slug']) && $overrides['target_slug'] !== '') {
            $targetSlug = $this->normalizeCarreraSlug($overrides['target_slug']);
        }

        $docConfigSlug = null;
        if (isset($overrides['doc_config_slug']) && $overrides['doc_config_slug'] !== '') {
            $docConfigSlug = $this->normalizeCarreraSlug($overrides['doc_config_slug']);
        }

        if (!$targetSlug && $docConfigSlug) {
            $resolvedSlug = $this->resolveTargetCarreraSlug($docConfigSlug);
            if ($resolvedSlug) {
                $targetSlug = $resolvedSlug;
            }
        }

        $finalTargetSlug = $targetSlug ?: $docConfigSlug;
        if ($finalTargetSlug) {
            $this->setCarrera($finalTargetSlug);
        }

        $endpoint = 'titulacion/serviciostitulacion/mget_correlativo_abreviatura';
        $baseUrl = rtrim($this->currentUrl, '/');
        if (substr($baseUrl, -9) !== 'index.php') {
            $baseUrl .= '/index.php';
        }

        $requestUrl = $baseUrl . '/' . $endpoint;
        $params = [
            'abreviatura' => $abreviatura,
            'id_tipo_documento' => $idTipoDocumento,
            'anio' => $anio,
        ];

        $optionalKeys = ['cod_pensum', 'gestion', 'cod_grupo', 'cod_carrera'];
        foreach ($optionalKeys as $key) {
            if (isset($overrides[$key]) && $overrides[$key] !== null && $overrides[$key] !== '') {
                $params[$key] = (string) $overrides[$key];
            }
        }

        $sessionResult = $this->ensureWebSession();
        if (empty($sessionResult['success'])) {
            Log::warning('No se pudo establecer sesión SGA antes de solicitar correlativo', [
                'reason' => $sessionResult['message'] ?? 'unknown'
            ]);
            return [
                'success' => false,
                'message' => $sessionResult['message'] ?? 'No se pudo iniciar sesión en el SGA',
            ];
        }

        $cookieHeader = implode('; ', array_map(function ($cookieLine) {
            return explode(';', $cookieLine)[0];
        }, $this->sessionCookies));

        Log::info('Solicitando correlativo al SGA', [
            'url' => $requestUrl,
            'params' => $params,
        ]);

        try {
            $response = Http::asForm()
                ->timeout(15)
                ->withOptions([
                    'allow_redirects' => true,
                    'http_errors' => false,
                    'connect_timeout' => 5,
                ])
                ->withHeaders([
                    'Cookie' => $cookieHeader,
                    'Referer' => $this->currentUrl . 'titulacion/serviciostitulacion'
                ])
                ->post($requestUrl, $params);

            Log::info('Respuesta SGA correlativo', [
                'status' => $response->status(),
                'headers' => $response->headers(),
                'body_preview' => substr($response->body(), 0, 200),
            ]);

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'message' => 'Error en la consulta al SGA: ' . $response->status(),
                    'status' => $response->status(),
                ];
            }

            $raw = trim($response->body());
            if (stripos($raw, 'PHP Error') !== false || stripos($raw, 'Undefined index') !== false) {
                return [
                    'success' => false,
                    'message' => 'El SGA devolvió errores internos al solicitar el correlativo',
                    'body' => substr($raw, 0, 500),
                ];
            }
            $json = json_decode($raw, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return [
                    'success' => true,
                    'data' => $json,
                ];
            }

            if (is_numeric($raw)) {
                return [
                    'success' => true,
                    'data' => ['numero' => (int)$raw],
                ];
            }

            return [
                'success' => true,
                'data' => ['raw' => $raw],
            ];
        } catch (\Throwable $e) {
            Log::error('Error solicitando correlativo al SGA', [
                'error' => $e->getMessage(),
                'params' => $params,
            ]);

            return [
                'success' => false,
                'message' => 'Error de conexión: ' . $e->getMessage(),
            ];
        }
    }

    public function ensureWebSession($username = null, $password = null)
    {
        if (!empty($this->sessionCookies)) {
            return ['success' => true, 'cookies' => $this->sessionCookies];
        }

        $username = $username ?: $this->getConfigValue('web_user', env('SGA_WEB_USER'));
        $password = $password ?: $this->getConfigValue('web_password', env('SGA_WEB_PASSWORD'));

        if (!$username || !$password) {
            return [
                'success' => false,
                'message' => 'Credenciales SGA_WEB_* no configuradas',
            ];
        }

        return $this->loginWeb($username, $password);
    }

    public function getCargoDetalle($usuarioId)
    {
        $endpoint = 'index.php/documentos/generar_documentos/get_cargo_usuario';
        $requestUrl = $this->currentUrl . $endpoint;

        if (empty($this->sessionCookies)) {
            $sessionResult = $this->ensureWebSession();
            if (empty($sessionResult['success'])) {
                return $sessionResult;
            }
        }

        $cookieHeader = implode('; ', array_map(function ($cookieLine) {
            return explode(';', $cookieLine)[0];
        }, $this->sessionCookies));

        try {
            $response = Http::asForm()
                ->withHeaders([
                    'Cookie' => $cookieHeader,
                    'Referer' => $this->currentUrl . 'documentos/generar_documentos',
                ])
                ->post($requestUrl, [
                    'usuario' => $usuarioId,
                ]);

            if ($response->successful()) {
                $json = $response->json();
                return ['success' => true, 'data' => $json];
            }

            return [
                'success' => false,
                'status' => $response->status(),
                'body' => $response->body(),
                'message' => 'No se pudo obtener cargo del usuario',
            ];
        } catch (\Throwable $e) {
            Log::error('Error obteniendo cargo usuario SGA', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Error de conexión: ' . $e->getMessage(),
            ];
        }
    }

    public function buildDocumentoPayload(array $params)
    {
        $docType = strtoupper($params['codigo_tipo_documento']);
        $template = $this->docTemplates[$docType] ?? $params['archivo'] ?? null;

        if (!$template) {
            return [
                'success' => false,
                'message' => 'Plantilla no configurada para tipo ' . $docType,
            ];
        }

        $payload = [
            'carpeta' => $docType,
            'file' => $template,
            'emite' => $params['emite'],
            'nombre_emite' => $params['nombre_emite'],
            'cargo_emite' => $params['cargo_emite'],
            'id_cargo_emite' => $params['id_cargo_emite'],
            'formato_referencia' => $params['formato_referencia'] ?? 'false',
            'genero' => $params['genero'] ?? 'M',
            'tiene_via' => $params['tiene_via'] ?? 'false',
            'via_nombre' => $params['via_nombre'] ?? '',
            'via_cargo' => $params['via_cargo'] ?? '',
            'nombre_recibe' => $params['nombre_recibe'] ?? '',
            'id_cargo_recibe' => $params['id_cargo_recibe'] ?? '',
            'cargo_recibe' => $params['cargo_recibe'] ?? '',
            'institucion' => $params['institucion'] ?? '',
            'asunto' => $params['asunto'] ?? '',
        ];

        return ['success' => true, 'data' => $payload];
    }

    /**
     * Obtener comunicaciones internas filtrando por asunto.
     */
    public function getComunicacionesInternas(array $params = [])
    {
        $endpoint = 'api/socrates/comunicaciones_internas';
        $requestUrl = $this->currentUrl . $endpoint;

        $query = [];
        if (!empty($params['asunto'])) {
            $query['asunto'] = $params['asunto'];
        }
        if (!empty($params['estado'])) {
            $query['estado'] = $params['estado'];
        }
        if (!empty($params['limit'])) {
            $query['limit'] = $params['limit'];
        }

        try {
            $response = Http::withHeaders([
                'X-API-Key' => $this->apiKey,
                'Accept' => 'application/json',
            ])->get($requestUrl, $query);

            if ($response->successful()) {
                $json = $response->json();
                if (is_array($json)) {
                    return ['success' => true, 'data' => $json];
                }
                return ['success' => false, 'message' => 'Respuesta inesperada del SGA'];
            }

            Log::warning('SGA comunicacion interna no exitosa', [
                'status' => $response->status(),
                'url' => $requestUrl,
                'query' => $query,
                'body' => $response->body(),
            ]);

            return [
                'success' => false,
                'status' => $response->status(),
                'message' => 'Error en la consulta al SGA',
            ];
        } catch (\Throwable $e) {
            Log::error('Error solicitando comunicaciones internas al SGA', [
                'error' => $e->getMessage(),
                'url' => $requestUrl,
                'query' => $query,
            ]);

            return [
                'success' => false,
                'message' => 'Error de conexión: ' . $e->getMessage(),
            ];
        }
    }

    public function crearDocumento(array $payload)
    {
        $endpoint = 'index.php/documentos/generar_documentos/descargar_documento';
        $requestUrl = $this->currentUrl . $endpoint;

        if (empty($this->sessionCookies)) {
            return [
                'success' => false,
                'message' => 'Sesión SGA no iniciada',
            ];
        }

        $cookieHeader = implode('; ', array_map(function ($cookieLine) {
            return explode(';', $cookieLine)[0];
        }, $this->sessionCookies));

        try {
            $response = Http::asForm()
                ->withHeaders([
                    'Cookie' => $cookieHeader,
                    'Referer' => $this->currentUrl . 'documentos/generar_documentos',
                ])
                ->post($requestUrl, $payload);

            if ($response->successful() || in_array($response->status(), [200, 302])) {
                return [
                    'success' => true,
                    'body' => $response->body(),
                    'status' => $response->status(),
                ];
            }

            Log::warning('SGA crearDocumento no exitoso', [
                'status' => $response->status(),
                'url' => $requestUrl,
                'payload' => $payload,
                'response' => substr($response->body(), 0, 200)
            ]);

            return [
                'success' => false,
                'status' => $response->status(),
                'message' => 'Error al generar documento en SGA',
                'body' => $response->body(),
            ];
        } catch (\Throwable $e) {
            Log::error('Error llamando a crearDocumento en SGA', [
                'error' => $e->getMessage(),
                'url' => $requestUrl,
                'payload' => $payload,
            ]);

            return [
                'success' => false,
                'message' => 'Error de conexión: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Llama a los endpoints del SGA para obtener los pagos de Material Extra de un estudiante
     * intentando múltiples rutas conocidas y parseando el HTML resultante.
     * @param string $codigo
     * @return array
     */
    private function buscarPagosMaterialExtraPorCodigo($codigo)
    {
        try {
            $carrera = array_search($this->currentUrl, $this->baseUrls);
            if ($carrera === false || $carrera === null) {
                $carrera = 'unknown';
            }
            Log::info('Buscando Pagos de Material Extra', [
                'carrera' => $carrera,
                'url' => $this->currentUrl,
                'codigo' => $codigo,
            ]);
            
            $params = [
                'cod_ceta' => $codigo,
                'codigo' => $codigo,
                'cod_estudiante' => $codigo,
                'estudiante' => $codigo
            ];
            
            // Posibles endpoints en el SGA (se probarán en orden)
            // 1) Soporte .env con placeholder {cod_ceta}
            $envEndpoint = env('SGA_MATERIAL_EXTRA_ENDPOINT'); // ej: 'index.php/titulacion/serviciostitulacion/material_extra/{cod_ceta}'
            
            // 2) Rutas correctas según CodeIgniter RestServer (GET con segmento)
            $candidateEndpoints = array_filter([
                $envEndpoint,
                'index.php/titulacion/serviciostitulacion/material_extra/{cod_ceta}',
                'titulacion/serviciostitulacion/material_extra/{cod_ceta}', // si hay rewrite
                // Fallbacks legacy:
                'index.php/titulacion/serviciostitulacion/material_extra',
                'titulacion/serviciostitulacion/material_extra',
                'index.php/titulacion/serviciostitulacion/material_extra_get',
                'titulacion/serviciostitulacion/material_extra_get',
                'index.php/main/material_extra_get',
                'main/material_extra_get',
            ]);
            
            foreach ($candidateEndpoints as $endpoint) {
                // 1) Si el endpoint trae placeholder {cod_ceta} -> GET directo
                if (strpos($endpoint, '{cod_ceta}') !== false) {
                    $requestUrl = $this->currentUrl . str_replace('{cod_ceta}', urlencode($codigo), $endpoint);
                    Log::info('Intentando endpoint Material Extra (GET con placeholder)', [
                        'url' => $requestUrl
                    ]);

                    $ch = curl_init($requestUrl);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
                    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                    curl_setopt($ch, CURLOPT_HTTPHEADER, [
                        'Accept: text/html,application/xhtml+xml'
                    ]);
                    curl_setopt($ch, CURLOPT_ENCODING, '');
                    $rawResponse = curl_exec($ch);
                    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $error = curl_error($ch);
                    curl_close($ch);

                    $bodyPreview = $rawResponse ? substr($rawResponse, 0, 500) : '';
                    Log::debug('Respuesta raw Material Extra (cURL GET):', [
                        'status' => $statusCode,
                        'error' => $error,
                        'body_preview' => $bodyPreview
                    ]);

                    if ($statusCode >= 200 && $statusCode < 300 && !empty($rawResponse)) {
                        if (strpos($rawResponse, 'PHP Error') !== false || strpos($rawResponse, 'Fatal error') !== false) {
                            Log::warning('SGA devolvió errores PHP en Material Extra (GET)', [
                                'endpoint' => $endpoint,
                                'codigo' => $codigo,
                                'errors' => substr($rawResponse, 0, 1000)
                            ]);
                            continue;
                        }

                        $pagos = $this->parseMaterialExtraHtml($rawResponse);
                        if (!empty($pagos)) {
                            return [
                                'success' => true,
                                'data' => $pagos,
                                'total' => count($pagos),
                                'carrera' => $carrera,
                                'codigo' => $codigo,
                                'endpoint' => $endpoint,
                                'method' => 'GET'
                            ];
                        }
                    }
                    // Si no funcionó, continuar con el siguiente endpoint
                    continue;
                }

                // 2) Intento GET agregando el segmento /{cod_ceta}
                $requestUrlGet = $this->currentUrl . rtrim($endpoint, '/') . '/' . urlencode($codigo);
                Log::info('Intentando endpoint Material Extra (GET con segmento)', [
                    'url' => $requestUrlGet
                ]);

                $ch = curl_init($requestUrlGet);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 15);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Accept: text/html,application/xhtml+xml'
                ]);
                curl_setopt($ch, CURLOPT_ENCODING, '');
                $rawResponse = curl_exec($ch);
                $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $error = curl_error($ch);
                curl_close($ch);

                $bodyPreview = $rawResponse ? substr($rawResponse, 0, 500) : '';
                Log::debug('Respuesta raw Material Extra (cURL GET):', [
                    'status' => $statusCode,
                    'error' => $error,
                    'body_preview' => $bodyPreview
                ]);

                if ($statusCode >= 200 && $statusCode < 300 && !empty($rawResponse)) {
                    if (strpos($rawResponse, 'PHP Error') !== false || strpos($rawResponse, 'Fatal error') !== false) {
                        Log::warning('SGA devolvió errores PHP en Material Extra (GET con segmento)', [
                            'endpoint' => $endpoint,
                            'codigo' => $codigo,
                            'errors' => substr($rawResponse, 0, 1000)
                        ]);
                    } else {
                        $pagos = $this->parseMaterialExtraHtml($rawResponse);
                        if (!empty($pagos)) {
                            return [
                                'success' => true,
                                'data' => $pagos,
                                'total' => count($pagos),
                                'carrera' => $carrera,
                                'codigo' => $codigo,
                                'endpoint' => $endpoint,
                                'method' => 'GET'
                            ];
                        }
                    }
                }

                // 3) Fallback: intentar POST con form-data (algunos ambientes lo usan)
                $requestUrlPost = $this->currentUrl . $endpoint;
                Log::info('Intentando endpoint Material Extra (POST form-data)', [
                    'url' => $requestUrlPost,
                    'params' => $params
                ]);

                $ch = curl_init($requestUrlPost);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 15);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Accept: text/html,application/xhtml+xml'
                ]);
                curl_setopt($ch, CURLOPT_ENCODING, '');
                $rawResponse = curl_exec($ch);
                $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $error = curl_error($ch);
                curl_close($ch);

                $bodyPreview = $rawResponse ? substr($rawResponse, 0, 500) : '';
                Log::debug('Respuesta raw Material Extra (cURL POST):', [
                    'status' => $statusCode,
                    'error' => $error,
                    'body_preview' => $bodyPreview
                ]);

                if ($statusCode >= 200 && $statusCode < 300 && !empty($rawResponse)) {
                    if (strpos($rawResponse, 'PHP Error') !== false || strpos($rawResponse, 'Fatal error') !== false) {
                        Log::warning('SGA devolvió errores PHP en Material Extra (POST)', [
                            'endpoint' => $endpoint,
                            'codigo' => $codigo,
                            'errors' => substr($rawResponse, 0, 1000)
                        ]);
                        continue;
                    }
                    $pagos = $this->parseMaterialExtraHtml($rawResponse);
                    if (!empty($pagos)) {
                        return [
                            'success' => true,
                            'data' => $pagos,
                            'total' => count($pagos),
                            'carrera' => $carrera,
                            'codigo' => $codigo,
                            'endpoint' => $endpoint,
                            'method' => 'POST'
                        ];
                    }
                }
            }
            
            Log::warning('No se pudo obtener Material Extra del SGA', [
                'codigo' => $codigo,
                'url' => $this->currentUrl
            ]);
            
            return [
                'success' => false,
                'message' => 'No se encontraron pagos de material extra o el endpoint no respondió.'
            ];
        } catch (\Exception $e) {
            Log::error('Error en buscarPagosMaterialExtraPorCodigo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTrace(),
                'codigo' => $codigo
            ]);
            
            return [
                'success' => false,
                'message' => 'Error de conexión: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Parsear el HTML del SGA para extraer pagos de Material Extra
     * Retorna un array de elementos: concepto, monto, num_factura, num_comprobante, fecha, razon, nit, gestion
     */
    private function parseMaterialExtraHtml($html)
    {
        $pagos = [];
        if (trim($html) === '') { return $pagos; }
        
        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        $dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        $xpath = new \DOMXPath($dom);
        
        // Intentar localizar una tabla específica por ID o por encabezados
        $tableNodes = $xpath->query("//table[@id='dataTables-pagos_material_extra'] | //table");
        
        foreach ($tableNodes as $table) {
            $rows = $xpath->query('.//tr', $table);
            if ($rows->length < 2) { continue; }
            
            // Determinar si esta es la tabla objetivo por ID
            $isTargetTable = false;
            if ($table instanceof \DOMElement) {
                $tableId = strtolower($table->getAttribute('id'));
                $isTargetTable = ($tableId === 'datatables-pagos_material_extra' || $tableId === 'dataTables-pagos_material_extra');
            }

            // Encontrar la fila de encabezados REAL (con columnas como Concepto/Monto)
            $headerRowIndex = -1;
            $headers = [];
            $headerRowsFound = [];
            for ($r = 0; $r < $rows->length; $r++) {
                $ths = $xpath->query('.//th', $rows->item($r));
                if ($ths->length > 0) {
                    $currentHeaders = [];
                    foreach ($ths as $th) {
                        $currentHeaders[] = trim($th->textContent);
                    }
                    $headerTextCandidate = strtolower(implode(' ', $currentHeaders));
                    if (strpos($headerTextCandidate, 'concepto') !== false || strpos($headerTextCandidate, 'monto') !== false) {
                        $headers = $currentHeaders;
                        $headerRowIndex = $r;
                        break;
                    }
                    $headerRowsFound[] = ['index' => $r, 'headers' => $currentHeaders];
                }
            }
            if ($headerRowIndex === -1 && !empty($headerRowsFound)) {
                // Fallback: usar la última fila con ths (típicamente la 2da fila del thead)
                $last = end($headerRowsFound);
                $headerRowIndex = $last['index'];
                $headers = $last['headers'];
            }

            // Validación: tabla correcta si es la de ID conocido o si headers contienen columnas esperadas
            $headerText = strtolower(implode(' ', $headers));
            $looksLikeMaterialExtra = $isTargetTable || (strpos($headerText, 'concepto') !== false && strpos($headerText, 'monto') !== false);
            if (!$looksLikeMaterialExtra && $headerRowIndex > 0) {
                // Heurística adicional: filas previas con texto 'Material Extra'
                for ($r = max(0, $headerRowIndex - 2); $r < $headerRowIndex; $r++) {
                    $txt = strtolower(trim($rows->item($r)->textContent));
                    if (strpos($txt, 'material extra') !== false) {
                        $looksLikeMaterialExtra = true;
                        break;
                    }
                }
            }
            if (!$looksLikeMaterialExtra) { continue; }
            
            $startRow = ($headerRowIndex > -1) ? $headerRowIndex + 1 : 1;
            for ($i = $startRow; $i < $rows->length; $i++) {
                $cells = $xpath->query('.//td', $rows->item($i));
                if ($cells->length < 6) { continue; }
                
                // Mapeo por posición (ignorar la primera columna 'Nº' si existe en headers)
                $hasNumero = false;
                foreach ($headers as $h) {
                    $hLower = strtolower($h);
                    if (strpos($hLower, 'nº') !== false || strpos($hLower, 'n°') !== false || strpos($hLower, 'nro') !== false || $hLower === 'n' || $hLower === 'no') {
                        $hasNumero = true; break;
                    }
                }
                $offset = $hasNumero ? 1 : 0;
                
                // Evitar filas de totales u otras
                $cell0 = $cells->item($offset + 0);
                $cell1 = $cells->item($offset + 1);
                $cell2 = $cells->item($offset + 2);
                $cell3 = $cells->item($offset + 3);
                $cell4 = $cells->item($offset + 4);
                $cell5 = $cells->item($offset + 5);
                $cell6 = $cells->item($offset + 6);
                $gestion = trim($cell0 ? $cell0->textContent : '');
                $fecha = trim($cell1 ? $cell1->textContent : '');
                $concepto = trim($cell2 ? $cell2->textContent : '');
                $monto = trim($cell3 ? $cell3->textContent : '');
                $numFactura = trim($cell4 ? $cell4->textContent : '');
                $numComprobante = trim($cell5 ? $cell5->textContent : '');
                $razonNit = trim($cell6 ? $cell6->textContent : '');
                
                if ($concepto === '' && $monto === '' && $fecha === '') { continue; }
                
                $razon = '';
                $nit = '';
                if (strpos($razonNit, '/') !== false) {
                    $parts = array_map('trim', explode('/', $razonNit, 2));
                    $razon = isset($parts[0]) ? $parts[0] : '';
                    $nit = isset($parts[1]) ? $parts[1] : '';
                } else {
                    // Si viene en una sola columna, intentar separar por espacios si parece NIT al final
                    $razon = $razonNit;
                }

                $pagos[] = [
                    'gestion' => $gestion,
                    'fecha' => $fecha,
                    'concepto' => $concepto,
                    'monto' => $monto,
                    'num_factura' => $numFactura,
                    'num_comprobante' => $numComprobante,
                    'razon' => $razon,
                    'nit' => $nit,
                ];
            }
            
            if (!empty($pagos)) { break; }
        }
        
        return $pagos;
    }
}