<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

abstract class CrudController extends Controller
{
    /** @var string */
    protected $modelClass;

    /**
     * Reglas de validación para store/update.
     */
    protected function rules()
    {
        return array();
    }

    public function index()
    {
        $modelClass = $this->modelClass;
        return response()->json($modelClass::query()->paginate(15));
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        $modelClass = $this->modelClass;
        $model = $modelClass::create($data);
        return response()->json($model, 201);
    }

    public function show($id)
    {
        $modelClass = $this->modelClass;
        $model = $modelClass::findOrFail($id);
        return response()->json($model);
    }

    public function update(Request $request, $id)
    {
        $data = $this->validateData($request, false);
        $modelClass = $this->modelClass;
        $model = $modelClass::findOrFail($id);
        $model->update($data);
        return response()->json($model);
    }

    public function destroy($id)
    {
        $modelClass = $this->modelClass;
        $model = $modelClass::findOrFail($id);
        
        // Para mayor compatibilidad en PHP 5.5
        if (method_exists($model, 'delete')) {
            $model->delete();
        } else {
            // Fallback: usar destroy estático
            $modelClass::destroy($id);
        }
        
        return response()->json(array('message' => 'Eliminado correctamente'));
    }

    protected function validateData($request, $isCreate = true)
    {
        $rules = $this->rules();
        
        if (!$isCreate && !empty($rules)) {
            // Para update, hacer las reglas opcionales
            foreach ($rules as $key => $rule) {
                if (is_array($rule)) {
                    $rules[$key] = array_diff($rule, array('required'));
                } else {
                    $rules[$key] = str_replace('required|', '', (string)$rule);
                }
            }
        }
        
        return !empty($rules) ? $request->validate($rules) : $request->all();
    }
}