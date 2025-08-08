<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class SocratesApiService
{
    private $baseUrls;
    private $apiKey;
    private $token;
    private $currentUrl;

    public function __construct()
    {
        // URLs base del SGA desde dentro del container Docker para cada carrera
        // Usamos el proxy nginx configurado en el servidor
        // Las rutas /sga-electricidad/ y /sga-mecanica/ están configuradas como proxy en nginx
        // Asegurarnos de que todas las URLs terminen con /
        $this->baseUrls = [
            'mecanica' => rtrim(env('SGA_MECANICA_URL', 'http://server/sga-mecanica'), '/') . '/',
            'electricidad' => rtrim(env('SGA_ELECTRICIDAD_URL', 'http://server/sga-electricidad'), '/') . '/', 
            'default' => rtrim(env('SGA_API_URL', 'http://server/sga-mecanica'), '/') . '/',
        ];
        
        // URL por defecto
        $this->currentUrl = $this->baseUrls['default'];
        $this->apiKey = env('SGA_API_KEY', 'SOCRATES_SGA_API_KEY_2025');
        
        // Registrar las URLs configuradas para debugging
        Log::info('URLs del SGA configuradas', [
            'mecanica' => $this->baseUrls['mecanica'],
            'electricidad' => $this->baseUrls['electricidad'],
            'default' => $this->baseUrls['default'],
            'current' => $this->currentUrl
        ]);
    }
    
    /**
     * Establecer la carrera para determinar la URL a usar
     */
    public function setCarrera($carrera)
    {
        $carrera = strtolower($carrera);
        
        if ($carrera == 'mecanica' || $carrera == 'mecánica' || $carrera == 'automotriz') {
            $this->currentUrl = $this->baseUrls['mecanica'];
            return true;
        } elseif ($carrera == 'electricidad' || $carrera == 'electrónica' || $carrera == 'electronica') {
            $this->currentUrl = $this->baseUrls['electricidad'];
            return true;
        } else {
            // Si no se especifica o no coincide, usar la URL por defecto
            $this->currentUrl = $this->baseUrls['default'];
            return false;
        }
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
        
        // Si hay cod_ceta, usar búsqueda por código
        if (isset($params['cod_ceta'])) {
            return $this->buscarEstudiantesPorCodigo($params['cod_ceta']);
        }
        
        // Si hay nombre, usar búsqueda por nombre
        if (isset($params['nombre'])) {
            return $this->buscarEstudiantesPorNombre($params['nombre']);
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
            $carrera = array_search($this->currentUrl, $this->baseUrls) ?: 'unknown';
            Log::info('URL actual para buscar estudiante por código', [
                'carrera' => $carrera,
                'url' => $this->currentUrl
            ]);
            
            // Probar diferentes nombres de parámetros que puede esperar el SGA
            $params = [
                'cod_ceta' => $codigo,
                'codigo' => $codigo,
                'cod_estudiante' => $codigo,
                'estudiante' => $codigo
            ];
            
            $endpoint = 'index.php/main/buscar_estudiantes_por_cod';
            $requestUrl = $this->currentUrl . $endpoint;
            
            Log::info('Enviando request al SGA', [
                'url' => $requestUrl,
                'params' => $params
            ]);

            // Configuración mejorada para la solicitud HTTP
            $response = Http::asForm()
                ->timeout(15) // Timeout aumentado
                ->withOptions([
                    'allow_redirects' => true, // Seguir redirecciones automáticamente
                    'http_errors' => false, // No lanzar excepción por errores HTTP
                    'connect_timeout' => 5 // Timeout de conexión
                ])
                ->post($requestUrl, $params);

            Log::info('Respuesta del SGA', [
                'status' => $response->status(),
                'headers' => $response->headers(),
                'body_preview' => substr($response->body(), 0, 500)
            ]);

            if ($response->successful()) {
                $html = $response->body();
                
                if (strpos($html, 'PHP Error') !== false || strpos($html, 'Fatal error') !== false) {
                    Log::warning('SGA devuelve errores PHP', [
                        'codigo' => $codigo,
                        'errors' => substr($html, 0, 1000)
                    ]);
                    return ['success' => false, 'message' => 'Error interno del SGA'];
                }
                
                $estudiantes = $this->parseEstudiantesHtml($html);
                
                return [
                    'success' => true,
                    'data' => $estudiantes
                ];
            }

            // Si el código es 301 o 302, probablemente se debe a un problema de redirección
            if ($response->status() == 301 || $response->status() == 302) {
                $redirectUrl = $response->header('Location');
                Log::warning('SGA intentó redireccionar', [
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
                            'data' => $estudiantes
                        ];
                    }
                }
            }

            Log::warning('SGA buscar_estudiantes_por_cod no exitoso', [
                'codigo' => $codigo,
                'status' => $response->status(),
                'headers' => $response->headers(),
                'response_body' => substr($response->body(), 0, 500)
            ]);
            
            return [
                'success' => false, 
                'message' => 'Error en consulta SGA: ' . $response->status()
            ];
        } catch (\Exception $e) {
            Log::error('Error en buscarEstudiantesPorCodigo', [
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
     * Buscar estudiantes por nombre usando el endpoint real del SGA
     * @param string $nombre Nombre del estudiante
     * @param int $limit Límite de resultados
     * @param int $offset Desplazamiento para paginación
     * @param string|null $carrera Carrera para determinar la URL del SGA
     */
    public function buscarEstudiantesPorNombre($nombre, $limit = 100, $offset = 0, $carrera = null)
    {
        try {
            $response = Http::asForm()
                ->timeout(8)
                ->post($this->currentUrl . '/index.php/main/buscar_estudiantes/nombre', [
                    'nombre' => $nombre
                ]);

            if ($response->successful()) {
                $html = $response->body();
                $estudiantes = $this->parseEstudiantesHtml($html);
                
                return [
                    'success' => true,
                    'data' => $estudiantes
                ];
            }

            Log::warning('SGA buscar_estudiantes/nombre no exitoso', [
                'nombre' => $nombre,
                'status' => $response->status(),
            ]);
            
            return ['success' => false, 'message' => 'Error en consulta SGA'];
        } catch (Exception $e) {
            Log::error('Excepción SGA buscar_estudiantes/nombre', [
                'nombre' => $nombre,
                'error' => $e->getMessage(),
            ]);
            
            return ['success' => false, 'message' => 'Error de conexión'];
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

            if ($method === 'GET') {
                $response = $response->get($this->baseUrl . $endpoint, $params);
            } else {
                $response = $response->post($this->baseUrl . $endpoint, $params);
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
                    $headerKeywords = ['Código', 'Nombre', 'Apellido', 'Cédula', 'Procedencia', 'Email', 'Teléfono'];
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

            // Procesar filas de datos (después de los headers)
            for ($i = $headerRowIndex + 1; $i < $rows->length; $i++) {
                $cells = $xpath->query('.//td', $rows->item($i));
                if ($cells->length === 0) { continue; }

                $row = [];
                for ($c = 0; $c < $cells->length; $c++) {
                    $key = $headers[$c] ?? 'col'.($c+1);
                    $value = trim($cells->item($c)->textContent);
                    $row[$key] = $value;
                }
                
                Log::info('Fila procesada', ['row' => $row]);

                // Mapear a estructura conocida con más variaciones
                $estudiante = [
                    'cod_ceta' => $this->extractField($row, ['Cod. CETA', 'Código', 'CODIGO', 'Cod_ceta', 'COD_CETA', 'col1']),
                    'nombres' => $this->extractField($row, ['Nombres', 'NOMBRES', 'Nombre', 'NOMBRE']),
                    'ap_paterno' => $this->extractField($row, ['Ap. Paterno', 'Apellido Paterno', 'AP_PATERNO', 'Paterno']),
                    'ap_materno' => $this->extractField($row, ['Ap. Materno', 'Apellido Materno', 'AP_MATERNO', 'Materno']),
                    'numero_doc' => $this->extractField($row, ['Cédula de Identidad', 'CEDULA', 'Numero_doc', 'CI']),
                    'procedencia' => $this->extractField($row, ['Procedencia', 'PROCEDENCIA']),
                    'email' => $this->extractField($row, ['Email', 'EMAIL', 'Correo']),
                    'telefono' => $this->extractField($row, ['Teléfono', 'TELEFONO', 'Telefono']),
                    'raw' => $row
                ];

                // Filtrar filas que tengan al menos cod_ceta o nombres
                if (!empty($estudiante['cod_ceta']) || !empty($estudiante['nombres'])) {
                    $estudiantes[] = $estudiante;
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
}