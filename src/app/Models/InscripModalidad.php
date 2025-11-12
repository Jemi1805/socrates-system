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
        'convocatoria_id',
        'nom_convocatoria',
        'aranceles_completos',
    ];

    protected $casts = [
        'fecha_inscripcion' => 'date',
        'convocatoria_id' => 'integer',
        'aranceles_completos' => 'boolean',
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

        static::saved(function (self $model) {
            $modalidadNombre = $model->modalidad_nom ? trim((string) $model->modalidad_nom) : null;

            Proyecto::withoutEvents(function () use ($model, $modalidadNombre) {
                $updates = [
                    'tipo' => $modalidadNombre,
                    'inscrip_modalidad_id' => $model->id,
                ];

                Proyecto::where('inscrip_modalidad_id', $model->id)->update($updates);

                if (!empty($model->cod_ceta_est)) {
                    Proyecto::whereNull('inscrip_modalidad_id')
                        ->where('cod_ceta', (string) $model->cod_ceta_est)
                        ->update($updates);
                }
            });
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

    public function convocatoria()
    {
        return $this->belongsTo(Convocatoria::class, 'convocatoria_id');
    }
}
