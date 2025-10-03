<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiplomaBachiller extends Model
{
    use HasFactory;

    protected $table = 'diploma_bachiller';
    // Clave primaria real de la tabla es 'id'
    protected $primaryKey = 'id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'cod_ceta_est',
        'tipo_bachiller',
        'nro_serie_titulo',
        'emision',
        'fecha_emision',
        'observacion',
        'gestion_bachillerato',
        'nro_resolucion',
        'fecha_resolucion',
        'is_active',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
        'fecha_resolucion' => 'date',
        'is_active' => 'boolean',
    ];

    public function documentoRequerido()
    {
        return $this->belongsTo(DocumentosRequeridos::class, 'id_doc_req');
    }

    /**
     * Relación inversa con postulante
     */
    public function postulante()
    {
        return $this->belongsTo(Postulante::class, 'cod_ceta_est', 'cod_ceta');
    }

    /**
     * Grados de bachiller extranjero asociados al diploma
     */
    public function gradosExtranjero()
    {
        return $this->hasMany(GradosBachExtranjero::class, 'diploma_bachiller_id');
    }

    /**
     * Transitabilidad Educación Regular asociada al diploma
     */
    public function transitabilidadesEduReg()
    {
        return $this->hasMany(TransitabilidadEduReg::class, 'diploma_bachiller_id');
    }

    /**
     * Transitabilidad Técnico Medio asociada al diploma
     */
    public function transitabilidadesInstTec()
    {
        return $this->hasMany(TransitabilidadInstTec::class, 'diploma_bachiller_id');
    }

    /**
     * Traspasos de Instituto asociados al diploma
     */
    public function traspasosInstituto()
    {
        return $this->hasMany(TraspasosInstituto::class, 'diploma_bachiller_id');
    }

    /**
     * Homologaciones por Cambio de Plan asociadas al diploma
     */
    public function homologacionesCambioPlan()
    {
        return $this->hasMany(HomologacionCambioPlan::class, 'diploma_bachiller_id');
    }
}
