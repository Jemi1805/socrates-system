<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class SocratesApiService
{
    private $baseUrl;
    private $apiKey;
    private $token;

    public function __construct()
    {
        // Configurar la URL base del SGA (ajusta según tu configuración)
        $this->baseUrl = env('SGA_API_URL', 'http://localhost/sga');
        $this->apiKey = env('SGA_API_KEY', 'SOCRATES_SGA_API_KEY_2025');
    }

    /**
     * Autenticar con el SGA
     */
    public function authenticate($username, $password)
    {
        try {
            $response = Http::post($this->baseUrl . '/api/socrates/authenticate', [
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
     * Obtener estudiantes del SGA
     */
    public function getEstudiantes($params = [])
    {
        return $this->makeApiRequest('GET', '/api/socrates/estudiantes', $params);
    }

    /**
     * Obtener un estudiante por código CETA
     */
    public function getEstudianteByCodigo($codCeta)
    {
        return $this->makeApiRequest('GET', '/api/socrates/estudiantes', ['cod_ceta' => $codCeta]);
    }

    /**
     * Buscar estudiantes por nombre
     */
    public function buscarEstudiantesPorNombre($nombre, $limit = 100, $offset = 0)
    {
        return $this->makeApiRequest('GET', '/api/socrates/estudiantes', [
            'nombre' => $nombre,
            'limit' => $limit,
            'offset' => $offset
        ]);
    }

    /**
     * Obtener carreras activas
     */
    public function getCarreras()
    {
        return $this->makeApiRequest('GET', '/api/socrates/carreras');
    }

    /**
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
     */
    public function checkConnection()
    {
        try {
            $response = Http::timeout(5)->get($this->baseUrl . '/api/socrates/gestiones');
            return $response->successful();
        } catch (Exception $e) {
            Log::error('Error de conexión al SGA', ['error' => $e->getMessage()]);
            return false;
        }
    }
} 