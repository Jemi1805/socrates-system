<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArancelesEst extends Model
{
    use HasFactory;
    
    protected $table = 'aranceles_est';
    
    protected $fillable = [
        'cod_ceta_est',
        'concepto',
        'monto',
        'pagado',
        'fecha_pago'
    ];
    
    protected $casts = [
        'monto' => 'decimal:2',
        'pagado' => 'boolean',
        'fecha_pago' => 'date'
    ];
    
    // Relación con inscripción modalidad
    public function inscripcionModalidad()
    {
        return $this->hasOne(InscripModalidad::class, 'aranceles_id');
    }
}
