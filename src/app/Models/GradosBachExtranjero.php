<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GradosBachExtranjero extends Model
{
    use HasFactory;

    protected $table = 'grados_bach_extranjero';

    protected $fillable = [
        'diploma_bachiller_id',
        'grado',
        'gestion',
    ];

    public function diplomaBachiller()
    {
        // Especificar owner key 'id' porque el modelo DiplomaBachiller tiene primaryKey personalizado
        return $this->belongsTo(DiplomaBachiller::class, 'diploma_bachiller_id', 'id');
    }
}
