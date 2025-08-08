<?php

namespace App\Http\Controllers;

use App\Services\SocratesApiService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

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
        
        return response()->json([
            'success' => $isConnected,
            'message' => $isConnected ? 'Conexión exitosa al SGA' : 'Error de conexión al SGA',
            'carrera' => $carrera ?: 'default'
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
            return response()->json([
                'success' => true,
                'data' => isset($result['data'][0]) ? $result['data'][0] : null,
                'carrera' => $carrera ?: 'default'
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
            'nombre' => 'required|string|min:2',
            'limit' => 'integer|min:1|max:100',
            'offset' => 'integer|min:0',
            'carrera' => 'string|nullable'
        ]);

        $carrera = $request->get('carrera');
        $result = $this->sgaService->buscarEstudiantesPorNombre(
            $request->nombre,
            $request->get('limit', 100),
            $request->get('offset', 0),
            $carrera
        );

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result,
                'carrera' => $carrera ?: 'default'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Error al buscar estudiantes'
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
                    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
                    'server_name' => $_SERVER['SERVER_NAME'] ?? 'unknown',
                    'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
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