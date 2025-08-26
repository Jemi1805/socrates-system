<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RaHomolEx extends Model
{
    use HasFactory;

    protected $table = 'ra_homol_ex';

    protected $fillable = [
        'id_doc_req',
        'nro_res',
        'fecha_emision',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
    ];

    public function grados()
    {
        return $this->hasMany(GradoHomol::class, 'homologacion_id');
    }
}
