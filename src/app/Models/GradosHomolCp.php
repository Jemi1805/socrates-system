<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GradosHomolCp extends Model
{
    use HasFactory;

    protected $table = 'grados_homol_cp';

    protected $fillable = [
        'homol_cp_id',
        'grado',
        'gestion',
    ];

    public function homologacion()
    {
        return $this->belongsTo(ResHomolCp::class, 'homol_cp_id');
    }
}
