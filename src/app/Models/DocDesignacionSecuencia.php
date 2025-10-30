<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocDesignacionSecuencia extends Model
{
    use HasFactory;

    protected $table = 'doc_designacion_secuencias';

    protected $fillable = [
        'doc_tipo',
        'year',
        'last_correlativo',
    ];
}
