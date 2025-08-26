<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GradosTrasp extends Model
{
    use HasFactory;

    protected $table = 'grados_trasp';

    protected $fillable = [
        'traspaso_id',
        'grado',
        'gestion',
    ];

    public function traspaso()
    {
        return $this->belongsTo(TraspasosInstituto::class, 'traspaso_id');
    }
}
