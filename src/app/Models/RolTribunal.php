<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RolTribunal extends Model
{
    use HasFactory;

    protected $table = 'rol_tribunal';

    protected $fillable = [
        'codigo',
        'nombre',
        'activo',
    ];
}
