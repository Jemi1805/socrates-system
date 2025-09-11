<?php

namespace App\Http\Controllers\Api;

use App\Models\InscripModalidad;
use App\Models\ArancelesEst;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InscripModalidadController extends CrudController
{
    protected $modelClass = InscripModalidad::class;
    
    protected function rules()
    {
        return [
            'cod_ceta_est' => 'nullable|integer',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            // columnas legacy removidas
            'fecha_inscripcion' => 'nullable|date',
            'estado' => 'nullable|string|max:255',
        ];
    }

    // Registro de inscripción con aranceles seleccionados en una sola operación
    public function storeWithAranceles(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
            'nombres_est' => 'nullable|string|max:150',
            'apellidos_est' => 'nullable|string|max:200',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            'modalidad_nom' => 'nullable|string|max:120',
            'aranceles_completos' => 'nullable|boolean',
            'user_id' => 'nullable|integer',
            'user_name' => 'nullable|string|max:150',
            'aranceles' => 'array',
            'aranceles.*.id' => 'nullable|integer|exists:aranceles_est,id',
            'aranceles.*.gestion' => 'nullable|string|max:10',
            'aranceles.*.fecha' => 'nullable|date',
            'aranceles.*.concepto' => 'nullable|string|max:255',
            'aranceles.*.monto' => 'nullable|numeric',
            'aranceles.*.num_factura' => 'nullable|string|max:50',
            'aranceles.*.num_comprobante' => 'nullable|string|max:50',
            'aranceles.*.razon' => 'nullable|string|max:255',
            'aranceles.*.nit' => 'nullable|string|max:30',
            'aranceles.*.pagado' => 'nullable|boolean',
            'aranceles.*.origen' => 'nullable|string|max:20',
            'aranceles.*.seleccionado' => 'nullable|boolean',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($data, $user) {
            $ins = new InscripModalidad();
            $ins->cod_ceta_est = $data['cod_ceta_est'];
            if (isset($data['nombres_est'])) $ins->nombres_est = $data['nombres_est'];
            if (isset($data['apellidos_est'])) $ins->apellidos_est = $data['apellidos_est'];
            if (isset($data['modalidad_id'])) $ins->modalidad_id = $data['modalidad_id'];
            if (isset($data['modalidad_nom'])) $ins->modalidad_nom = $data['modalidad_nom'];
            if (isset($data['aranceles_completos'])) $ins->aranceles_completos = (bool)$data['aranceles_completos'];
            // Usuario registrador
            $ins->user_id = isset($data['user_id']) ? $data['user_id'] : ($user ? $user->id : null);
            $ins->user_name = isset($data['user_name']) ? $data['user_name'] : ($user ? $user->name : null);
            $ins->save();

            $allPaid = true;
            if (!empty($data['aranceles'])) {
                foreach ($data['aranceles'] as $a) {
                    $item = null;
                    if (!empty($a['id'])) {
                        $item = ArancelesEst::find($a['id']);
                    }
                    if (!$item) {
                        $item = new ArancelesEst();
                        $item->cod_ceta_est = $ins->cod_ceta_est;
                    }
                    $item->inscrip_modalidad_id = $ins->id;
                    if (isset($a['gestion'])) $item->gestion = $a['gestion'];
                    if (isset($a['fecha'])) $item->fecha = $a['fecha'];
                    if (isset($a['concepto'])) $item->concepto = $a['concepto'];
                    if (isset($a['monto'])) $item->monto = $a['monto'];
                    if (isset($a['num_factura'])) $item->num_factura = $a['num_factura'];
                    if (isset($a['num_comprobante'])) $item->num_comprobante = $a['num_comprobante'];
                    if (isset($a['razon'])) $item->razon = $a['razon'];
                    if (isset($a['nit'])) $item->nit = $a['nit'];
                    if (isset($a['origen'])) $item->origen = $a['origen'];
                    $item->seleccionado = isset($a['seleccionado']) ? (bool)$a['seleccionado'] : true;
                    $item->pagado = isset($a['pagado']) ? (bool)$a['pagado'] : false;
                    if (isset($a['pagado']) && $a['pagado']) {
                        // Si viene fecha de pago en payload, úsala; de lo contrario deja null para setearla externamente
                        if (isset($a['fecha_pago'])) $item->fecha_pago = $a['fecha_pago'];
                    }
                    $item->save();
                    if (!$item->pagado) $allPaid = false;
                }
            } else {
                // Si no hay aranceles en el payload, no es pago completo
                $allPaid = false;
            }

            // Actualizar pago completo si corresponde
            $ins->aranceles_completos = $allPaid ? 1 : 0;
            $ins->save();

            return response()->json([
                'success' => true,
                'message' => 'Inscripción registrada correctamente',
                'data' => [
                    'inscripcion' => $ins,
                ],
            ]);
        });
    }
}