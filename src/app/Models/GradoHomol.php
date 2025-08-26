<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GradoHomol extends Model
{
    use HasFactory;

    protected $table = 'grado_homol';

    protected $fillable = [
        'homologacion_id',
        'grado_sec',
        'gestion_sec',
    ];

    public function homologacion()
    {
        return $this->belongsTo(RaHomolEx::class, 'homologacion_id');
    }
}
