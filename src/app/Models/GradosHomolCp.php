<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GradosHomolCp extends Model
{
    use HasFactory;

    protected $table = 'grados_homologacion_cp';

    protected $fillable = [
        'homologacion_cambio_plan_id',
        'grado',
        'gestion',
    ];

    public function homologacionCambioPlan()
    {
        return $this->belongsTo(HomologacionCambioPlan::class, 'homologacion_cambio_plan_id');
    }
}
