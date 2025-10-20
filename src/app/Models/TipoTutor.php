<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TipoTutor extends Model
{
    use HasFactory;

    protected $table = 'tipo_tutor';

    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'is_active',
    ];
}
