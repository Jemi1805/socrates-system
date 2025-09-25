<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InscripModalidad extends Model
{
    use HasFactory;

    protected $table = 'inscrip_modalidad';

    protected $fillable = [
        'cod_ceta_est',
        'modalidad_id',
        'modalidad_nom',
        'pract_ind_id',
        'aranceles_id',
        'fecha_inscripcion',
        'estado',
    ];

    protected $casts = [
        'fecha_inscripcion' => 'date',
    ];

    public function modalidad()
    {
        return $this->belongsTo(Modalidad::class, 'modalidad_id');
    }

    public function practicaIndividual()
    {
        return $this->belongsTo(PractInd::class, 'pract_ind_id');
    }

    public function arancel()
    {
        return $this->belongsTo(ArancelesEst::class, 'aranceles_id');
    }

    public function documentosAdjuntos()
    {
        return $this->hasMany(DocumentosAdjuntos::class, 'inscripcion_id');
    }
}
