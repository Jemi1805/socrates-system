<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ResHomolCp extends Model
{
    use HasFactory;

    protected $table = 'res_homol_cp';

    protected $fillable = [
        'id_doc_req',
        'nro_res',
        'fecha_emision',
        'grados_cursados',
        'gestiones_cursadas',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
    ];

    public function grados()
    {
        return $this->hasMany(GradosHomolCp::class, 'homol_cp_id');
    }
}
