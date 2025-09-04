<?php

namespace App\Http\Controllers;

use App\Models\Postulante;
use App\Models\InscripModalidad;
use App\Models\Modalidad;
use Illuminate\Http\Request;

class PostulanteController extends Controller
{
    public function index()
    {
        return Postulante::all();
    }

    public function store(Request $request)
    {
        $postulante = Postulante::create($request->all());
        return response()->json($postulante, 201);
    }

    public function show($id)
    {
        return Postulante::findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $postulante = Postulante::findOrFail($id);
        $postulante->update($request->all());
        return response()->json($postulante, 200);
    }

    public function destroy($id)
    {
        Postulante::destroy($id);
        return response()->json(null, 204);
    }

    /**
     * Obtener la modalidad asignada al postulante (última por fecha_inscripcion)
     */
    public function getModalidad($cod_ceta)
    {
        $inscripcion = InscripModalidad::with('modalidad')
            ->where('cod_ceta_est', $cod_ceta)
            ->orderByDesc('fecha_inscripcion')
            ->first();

        if (!$inscripcion) {
            return response()->json(['message' => 'Sin modalidad asignada'], 404);
        }

        return response()->json($inscripcion);
    }

    /**
     * Asignar o actualizar modalidad del postulante (upsert por cod_ceta_est)
     */
    public function setModalidad(Request $request, $cod_ceta)
    {
        $data = $request->validate([
            'modalidad_id' => 'required|exists:modalidad,id',
            'estado' => 'nullable|string|max:255',
            'fecha_inscripcion' => 'nullable|date',
        ]);

        // Si no se envía fecha, usar hoy
        if (empty($data['fecha_inscripcion'])) {
            $data['fecha_inscripcion'] = now()->toDateString();
        }

        $payload = [
            'cod_ceta_est' => (int) $cod_ceta,
            'modalidad_id' => $data['modalidad_id'],
            'estado' => (isset($data['estado']) && $data['estado'] !== null) ? $data['estado'] : 'Inscrito',
            'fecha_inscripcion' => $data['fecha_inscripcion'],
        ];

        // Actualizar si existe, crear si no
        $inscripcion = InscripModalidad::updateOrCreate(
            ['cod_ceta_est' => (int) $cod_ceta],
            $payload
        );

        return response()->json($inscripcion, 200);
    }
}
