<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TraspasosInstituto extends Model
{
    use HasFactory;

    protected $table = 'traspasos_instituto';

    protected $fillable = [
        'cod_ceta_est',
        'id_doc_req',
        'instituto_origen',
        'grados_cursados',
        'gestiones_cursadas',
    ];

    public function grados()
    {
        return $this->hasMany(GradosTrasp::class, 'traspaso_id');
    }
}
