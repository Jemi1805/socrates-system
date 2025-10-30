<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocDesignacion extends Model
{
    use HasFactory;

    protected $table = 'doc_designaciones';

    protected $fillable = [
        'designacion_tutor_id',
        'doc_tipo',
        'year',
        'correlativo',
        'cite',
        'para_nombre',
        'para_cargo',
        'de_nombre',
        'de_cargo',
        'asunto',
        'introduccion',
        'cronograma_inicio',
        'cronograma_fin',
        'cierre',
        'pie_notas',
        'tutor_nombre',
        'tutor_titulo',
        'estudiantes_resumen',
    ];

    protected $casts = [
        'cronograma_inicio' => 'date',
        'cronograma_fin' => 'date',
        'pie_notas' => 'array',
        'estudiantes_resumen' => 'array',
    ];
}
