<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Postulante extends Model
{
    use HasFactory;

    protected $primaryKey = 'cod_ceta';

    // Atributos calculados que se incluyen automáticamente en las respuestas JSON
    protected $appends = ['carrera_nombre'];

    protected $fillable = [
        // Datos biográficos
        'cod_ceta',
        'nombres_est',
        'ap_pat',
        'ap_mat',
        'apellidos_est', // redundante (compatibilidad), puede componerse de ap_pat + ap_mat
        'ci',
        'complemento',
        'fecha_nacimiento',
        'lugar_nacimiento',
        'procedencia',
        'carrera',
        'pensum',

        // Otros campos existentes
        'expedido',
        'reg_ini_c',
        'gestion_ini',
        'reg_con_c',
        'gestion_fin',
        'incrip_uni'
    ];

    /**
     * Nombre de carrera "bonito" para mostrar en frontend
     */
    public function getCarreraNombreAttribute()
    {
        $raw = (string)(isset($this->attributes['carrera']) ? $this->attributes['carrera'] : '');
        $norm = trim(mb_strtolower($raw));

        // Mapas de normalización comunes (ajusta según tu catálogo real)
        $map = [
            'mecanica' => 'Mecánica Automotriz',
            'mecánica' => 'Mecánica Automotriz',
            'mecanica automotriz' => 'Mecánica Automotriz',
            'electricidad' => 'Electricidad y Electrónica Automotriz',
            'electricidad y electrónica automotriz' => 'Electricidad y Electrónica Automotriz',
            'electronica' => 'Electricidad y Electrónica Automotriz',
            'eléctrica' => 'Electricidad y Electrónica Automotriz',
            'eea' => 'Electricidad y Electrónica Automotriz',
            'mea' => 'Mecánica Automotriz',
        ];

        if (isset($map[$norm])) {
            return $map[$norm];
        }

        // Fallback: Title Case sencillo del valor almacenado
        return mb_convert_case($raw, MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * Relación con diploma_bachiller
     */
    public function diplomaBachiller()
    {
        return $this->hasMany(DiplomaBachiller::class, 'cod_ceta_est', 'cod_ceta');
    }

    /**
     * Relación con datos_carrera
     */
    public function datosCarrera()
    {
        return $this->hasMany(DatosCarrera::class, 'cod_ceta_est', 'cod_ceta');
    }

    /**
     * Relación con aranceles_est
     */
    public function aranceles()
    {
        return $this->hasMany(ArancelesEst::class, 'cod_ceta_est', 'cod_ceta');
    }

    /**
     * Relación con inscrip_modalidad
     */
    public function inscripcionesModalidad()
    {
        return $this->hasMany(InscripModalidad::class, 'cod_ceta_est', 'cod_ceta');
    }

    /**
     * Carreras asociadas vía tabla pivote datos_carrera
     */
    public function carreras()
    {
        return $this->belongsToMany(Carrera::class, 'datos_carrera', 'cod_ceta_est', 'cod_carrera', 'cod_ceta', 'cod_carrera');
    }

    /**
     * Tutores asignados al postulante mediante la pivote designacion_tutor
     */
    public function tutores()
    {
        return $this->belongsToMany(Tutor::class, 'designacion_tutor', 'cod_ceta', 'tutor_id', 'cod_ceta', 'id')
            ->withPivot(['proyecto_id', 'fecha_designacion', 'user_id', 'estudiante_nombre', 'tutor_nombre'])
            ->withTimestamps();
    }
}
