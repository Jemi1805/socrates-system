<?php

namespace App\Http\Controllers;

use App\Models\Postulante;
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
}
