<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;
use \InvalidArgumentException;

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
            'mecanica' => rtrim(env('SGA_MECANICA_URL', 'http://host.docker.internal/sgamea/'), '/') . '/',
            'electricidad' => rtrim(env('SGA_ELECTRICIDAD_URL', 'http://host.docker.internal/sga/'), '/') . '/', 
            'default' => rtrim(env('SGA_API_URL', 'http://host.docker.internal/sgamea/'), '/') . '/',
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
            
            $endpoint = 'index.php/titulacion/serviciostitulacion/buscar_estudiantes_por_cod';
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
            
            $requestUrl = $this->currentUrl . 'titulacion/serviciostitulacion/buscar_estudiantes/nombre';
            
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
                    'ci' => isset($row['Cédula de Identidad']) ? $row['Cédula de Identidad'] : '',
                    'procedencia' => isset($row['Procedencia']) ? $row['Procedencia'] : '',
                    'nro_serie_titulo' => isset($row['N° Serie Titulo de Bachiller']) ? $row['N° Serie Titulo de Bachiller'] : '',
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