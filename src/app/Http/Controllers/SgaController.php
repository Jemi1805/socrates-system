<?php

namespace App\Http\Controllers;

use App\Services\SocratesApiService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

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
    public function checkConnection()
    {
        $isConnected = $this->sgaService->checkConnection();
        
        return response()->json([
            'success' => $isConnected,
            'message' => $isConnected ? 'Conexión exitosa al SGA' : 'Error de conexión al SGA'
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
        $params = $request->only(['cod_ceta', 'nombre', 'limit', 'offset']);
        
        $result = $this->sgaService->getEstudiantes($params);

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result
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
        $result = $this->sgaService->getEstudianteByCodigo($codCeta);

        if ($result && !empty($result['data'])) {
            return response()->json([
                'success' => true,
                'data' => isset($result['data'][0]) ? $result['data'][0] : null
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
            'offset' => 'integer|min:0'
        ]);

        $result = $this->sgaService->buscarEstudiantesPorNombre(
            $request->nombre,
            $request->get('limit', 100),
            $request->get('offset', 0)
        );

        if ($result) {
            return response()->json([
                'success' => true,
                'data' => $result
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
} 