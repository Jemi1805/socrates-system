<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolTribunal;

class RolTribunalController extends Controller
{
    public function index()
    {
        $roles = RolTribunal::query()
            ->where('activo', true)
            ->orderBy('id')
            ->get(['id', 'codigo', 'nombre']);

        return response()->json([
            'success' => true,
            'data' => $roles,
        ]);
    }
}
