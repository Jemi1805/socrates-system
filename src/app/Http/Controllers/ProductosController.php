<?php

namespace App\Http\Controllers;

use App\Models\Productos;
use Illuminate\Http\Request;

class ProductosController extends Controller
{
    public function index()
    {
        $items = Productos::all();
        return response()->json($items);
    }

    public function store(Request $request)
    {
        $item = Productos::create($request->all());
        return response()->json($item, 201);
    }

    public function show(string $id)
    {
        $item = Productos::find($id);
        return response()->json($item);
    }

    public function update(Request $request, string $id)
    {
        $item = Productos::find($id);
        $item->update($request->all());
        return response()->json($item, 200);
    }

    public function destroy(string $id)
    {
        Productos::destroy($id);
        return response()->json(null, 204);
    }
}
