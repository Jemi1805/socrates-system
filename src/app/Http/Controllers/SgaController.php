<?php

namespace App\Http\Controllers;

use App\Services\SocratesApiService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SgaController extends Controller
{
    private $sgaService;

    public function __construct(SocratesApiService $sgaService)
    {
        $this->sgaService = $sgaService;
    }

    /**
     * Verificar conexión con el SGA
     */
    public function checkConnection(Request $request)
    {
        $carrera = $request->get('carrera');
        $isConnected = $this->sgaService->checkConnection($carrera);
        
        $message = 'Error de conexión al SGA';
        if ($isConnected) {
            $message = 'Conexión exitosa al SGA';
        }
        $carreraOut = 'default';
        if (!empty($carrera)) {
            $carreraOut = $carrera;
        }
        
        return response()->json([
            'success' => $isConnected,
            'message' => $message,
            'carrera' => $carreraOut
        ]);
    }
    
    /**
     * Obtener las URLs disponibles para las diferentes carreras
     */
    public function getAvailableUrls()
    {
        $urls = $this->sgaService->getAvailableUrls();
        
        return response()->json([
            'success' => true,
            'data' => [
                'urls' => $urls,
                'carreras' => [
                    'mecanica' => 'Mecánica Automotriz',
                    'electricidad' => 'Electricidad y Electrónica Automotriz'
                ]
            ]
        ]);
    }

    /**
     * Autenticar con el SGA
     */
    public function authenticate(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string'
        ]);

        $result = $this->sgaService->authenticate(
            $request->username,
            $request->password
        );

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Credenciales inválidas'
        ], 401);
    }

    /**
     * Obtener estudiantes del SGA
     */
    public function getEstudiantes(Request $request)
    {
        $params = $request->only(['cod_ceta', 'nombre', 'limit', 'offset', 'carrera']);
        
        $result = $this->sgaService->getEstudiantes($params);

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result,
                'carrera' => $request->get('carrera', 'default')
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Error al obtener estudiantes del SGA'
        ], 500);
    }

    /**
     * Obtener un estudiante específico por código CETA
     */
    public function getEstudianteByCodigo(Request $request, $codCeta)
    {
        $carrera = $request->get('carrera');
        $result = $this->sgaService->getEstudianteByCodigo($codCeta, $carrera);

        if ($result && !empty($result['data'])) {
            $carreraOut = 'default';
            if (!empty($carrera)) {
                $carreraOut = $carrera;
            }
            return response()->json([
                'success' => true,
                'data' => isset($result['data'][0]) ? $result['data'][0] : null,
                'carrera' => $carreraOut
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Estudiante no encontrado'
        ], 404);
    }

    /**
     * Buscar estudiantes por nombre
     */
    public function buscarEstudiantes(Request $request)
    {
        $request->validate([
            'nombres' => 'nullable|string',
            'ap_pat' => 'nullable|string',
            'ap_mat' => 'nullable|string',
            'limit' => 'integer|min:1|max:100',
            'offset' => 'integer|min:0',
            'carrera' => 'required|string' // La carrera es obligatoria
        ]);
        if (empty($request->nombres) && empty($request->ap_pat) && empty($request->ap_mat)) {
            return response()->json([
                'success' => false,
                'message' => 'Debe proporcionar al menos un criterio de búsqueda (nombres, ap_pat o ap_mat)'
            ], 400);
        }

        $carrera = $request->get('carrera');
        
        // Log para verificar los parámetros que llegan desde el cliente
        \Illuminate\Support\Facades\Log::info('Recibido request para buscarEstudiantes', [
            'nombres' => $request->get('nombres'),
            'ap_pat' => $request->get('ap_pat'),
            'ap_mat' => $request->get('ap_mat'),
            'carrera' => $carrera,
            'all_params' => $request->all()
        ]);
        
        $result = $this->sgaService->buscarEstudiantesPorNombre(
            $request->get('nombres', ''),
            $request->get('ap_pat', ''), 
            $request->get('ap_mat', ''),
            $request->get('limit', 100),
            $request->get('offset', 0),
            $carrera
        );

        if ($result && isset($result['success']) && $result['success']) {
            return response()->json(array(
                'success' => true,
                'data' => isset($result['data']) ? $result['data'] : array(),
                'total' => isset($result['total']) ? $result['total'] : (isset($result['data']) ? count($result['data']) : 0),
                'carrera' => $carrera
            ));
        }

        return response()->json([
            'success' => false,
            'message' => isset($result['message']) ? $result['message'] : 'Error al buscar estudiantes'
        ], 500);
    }

    /**
     * Obtener carreras activas
     */
    public function getCarreras()
    {
        $result = $this->sgaService->getCarreras();

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Error al obtener carreras'
        ], 500);
    }

    /**
     * Obtener gestiones activas
     */
    public function getGestiones()
    {
        $result = $this->sgaService->getGestiones();

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Error al obtener gestiones'
        ], 500);
    }

    /**
     * Obtener inscripciones de un estudiante
     */
    public function getInscripciones(Request $request, $codCeta)
    {
        $result = $this->sgaService->getInscripciones($codCeta);

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Error al obtener inscripciones'
        ], 500);
    }

    /**
     * Obtener pagos de Material Extra de un estudiante por código CETA
     */
    public function getPagosMaterialExtra(Request $request, $codCeta)
    {
        $carrera = $request->get('carrera');
        $result = $this->sgaService->getPagosMaterialExtra($codCeta, $carrera);

        if ($result && isset($result['success']) && $result['success']) {
            $data = array();
            if (isset($result['data'])) {
                $data = $result['data'];
            }

            $total = 0;
            if (isset($result['total'])) {
                $total = $result['total'];
            } else {
                if (isset($result['data'])) {
                    $total = count($result['data']);
                }
            }

            $carreraOut = 'default';
            if (!empty($carrera)) {
                $carreraOut = $carrera;
            }

            return response()->json(array(
                'success' => true,
                'data' => $data,
                'total' => $total,
                'carrera' => $carreraOut,
            ));
        }

        $message = 'Error al obtener pagos de material extra';
        if (is_array($result) && isset($result['message'])) {
            $message = $result['message'];
        }

        return response()->json(array(
            'success' => false,
            'message' => $message
        ), 500);
    }
    
    /**
     * Obtener lista de cod_pensum por carrera desde la base de datos.
     * Acepta 'cod_carrera' (MEA/EEA) o 'carrera' (mecanica/electricidad) y hace el mapeo.
     */
    public function getPensums(Request $request)
    {
        $codCarrera = $request->get('cod_carrera');
        $carreraRaw = $request->get('carrera');
        $carreraNorm = $this->normalizeCarrera($carreraRaw);
        if (empty($codCarrera)) {
            // Primero intentar resolver desde la tabla carrera por nombre
            $codCarrera = $this->findCodCarreraByNombre($carreraNorm);
            if ($codCarrera === null) {
                $codCarrera = $this->carreraToCodCarrera($carreraNorm);
            }
        }

        $pensums = [];
        if (Schema::hasTable('pensum')) {
            if (!empty($codCarrera)) {
                $pensums = DB::table('pensum')
                    ->where('cod_carrera', $codCarrera)
                    ->orderBy('orden')
                    ->orderBy('cod_pensum')
                    ->pluck('cod_pensum')
                    ->toArray();
            }

            // Reintento considerando diferencias de tipo (numérico vs string como 'MEA'/'EEA')
            if (empty($pensums) && !empty($carreraNorm)) {
                $dbCodCarrera = $this->findCodCarreraByNombre($carreraNorm);
                $stringCodCarrera = $this->carreraToCodCarrera($carreraNorm);
                $candidates = array_values(array_unique(array_filter([$codCarrera, $dbCodCarrera, $stringCodCarrera])));
                if (!empty($candidates)) {
                    $pensums = DB::table('pensum')
                        ->whereIn('cod_carrera', $candidates)
                        ->orderBy('orden')
                        ->orderBy('cod_pensum')
                        ->pluck('cod_pensum')
                        ->toArray();
                    if (!empty($pensums)) {
                        if (!empty($dbCodCarrera)) {
                            $codCarrera = $dbCodCarrera;
                        } elseif (!empty($stringCodCarrera)) {
                            $codCarrera = $stringCodCarrera;
                        }
                    }
                }
            }
        }

        // Fallback a config si no hay registros en BD
        if (empty($pensums)) {
            $config = config('sga_pensums');
            if (is_array($config)) {
                if (!empty($carreraNorm) && isset($config[$carreraNorm]) && is_array($config[$carreraNorm])) {
                    $pensums = $config[$carreraNorm];
                } elseif (isset($config['default']) && is_array($config['default'])) {
                    $pensums = $config['default'];
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => $pensums,
            'carrera' => $carreraNorm ?: 'default',
            'cod_carrera' => $codCarrera,
        ]);
    }

    /**
     * Obtener docentes del SGA (legacy)
     */
    public function getDocentes(Request $request)
    {
        $carreraRaw = $request->get('carrera');
        $carrera = $this->normalizeCarrera($carreraRaw);
        $result = $this->sgaService->getDocentes($carrera);

        if ($result && isset($result['success']) && $result['success']) {
            $data = isset($result['data']) ? $result['data'] : [];
            return response()->json([
                'success' => true,
                'data' => $data,
                'total' => isset($result['total']) ? $result['total'] : count($data),
                'carrera' => $carrera ?: 'default',
            ]);
        }

        $message = 'Error al obtener docentes';
        if (is_array($result) && isset($result['message'])) {
            $message = $result['message'];
        }

        return response()->json([
            'success' => false,
            'message' => $message,
        ], 500);
    }
    
    /**
     * Normaliza el nombre de la carrera a un código soportado por el backend
     */
    private function normalizeCarrera($carrera)
    {
        if (empty($carrera)) {
            return null;
        }
        $s = strtolower($carrera);
        // Detectar códigos directos
        if (strpos($s, 'mea') !== false) {
            return 'mecanica';
        }
        if (strpos($s, 'eea') !== false) {
            return 'electricidad';
        }
        if (strpos($s, 'elect') !== false) {
            return 'electricidad';
        }
        if (strpos($s, 'mec') !== false || strpos($s, 'automotriz') !== false) {
            return 'mecanica';
        }
        return null; // dejar que use default
    }

    /**
     * Mapea carrera normalizada a código de carrera en BD.
     */
    private function carreraToCodCarrera($carreraNorm)
    {
        if (empty($carreraNorm)) return null;
        if ($carreraNorm === 'mecanica') return 'MEA';
        if ($carreraNorm === 'electricidad') return 'EEA';
        return null;
    }

    /**
     * Intenta resolver el cod_carrera consultando la tabla 'carrera' por el nombre.
     * Soporta esquemas donde cod_carrera puede ser string (MEA/EEA) o numérico.
     */
    private function findCodCarreraByNombre($carreraNorm)
    {
        if (empty($carreraNorm)) {
            return null;
        }
        $query = DB::table('carrera')->select('cod_carrera');
        if ($carreraNorm === 'electricidad') {
            $query->whereRaw('LOWER(nombre_carrera) LIKE ?', ['%elect%']);
        } elseif ($carreraNorm === 'mecanica') {
            $query->whereRaw('LOWER(nombre_carrera) LIKE ?', ['%mec%'])
                  ->whereRaw('LOWER(nombre_carrera) NOT LIKE ?', ['%elect%']);
        } else {
            return null;
        }
        return $query->value('cod_carrera');
    }

    /**
     * Método de diagnóstico para probar la conexión con los SGA
     * @param string $carrera Carrera para determinar qué SGA probar
     */
    public function diagnosticarConexion($carrera)
    {
        try {
            $this->sgaService->setCarrera($carrera);
            $url = $this->sgaService->getCurrentUrl();
            
            // Hacer petición GET directa para verificar que responde
            $response = Http::timeout(10)->get($url);
            
            // Guardar el HTML para análisis
            $htmlContent = substr($response->body(), 0, 1000); // Primeros 1000 caracteres
            
            // Añadir un test con cURL para comparar resultados
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
            $curlResponse = curl_exec($ch);
            $curlError = curl_error($ch);
            $curlInfo = curl_getinfo($ch);
            curl_close($ch);
            
            return response()->json([
                'success' => true,
                'http_client' => [
                    'status' => $response->status(),
                    'success' => $response->successful(),
                    'headers' => $response->headers(),
                    'content_preview' => $htmlContent,
                ],
                'curl_client' => [
                    'success' => empty($curlError),
                    'error' => $curlError,
                    'info' => $curlInfo,
                    'content_length' => strlen($curlResponse),
                ],
                'url' => $url,
                'carrera' => $carrera,
                'server_info' => [
                    'php_version' => phpversion(),
                    'server_software' => isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : 'unknown',
                    'server_name' => isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'unknown',
                    'remote_addr' => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown',
                    'docker_networking' => shell_exec('hostname -I'),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'carrera' => $carrera
            ]);
        }
    }
} 