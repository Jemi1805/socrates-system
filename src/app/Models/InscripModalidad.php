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

    /**
     * Mantener sincronizado modalidad_nom según modalidad_id
     */
    protected static function booted()
    {
        static::saving(function (self $model) {
            // Si hay modalidad_id, asegurar que modalidad_nom refleje el nombre actual
            if ($model->modalidad_id) {
                if ($model->isDirty('modalidad_id') || empty($model->modalidad_nom)) {
                    $nombre = Modalidad::whereKey($model->modalidad_id)->value('nombre');
                    $model->modalidad_nom = $nombre ?: null;
                }
            } else {
                // Sin modalidad: limpiar nombre
                $model->modalidad_nom = null;
            }
        });
    }

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

    /**
     * Relación con Postulante por cod_ceta
     */
    public function postulante()
    {
        return $this->belongsTo(Postulante::class, 'cod_ceta_est', 'cod_ceta');
    }
}
