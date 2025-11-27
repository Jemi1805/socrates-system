<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DefensaTribunal extends Model
{
    use HasFactory;

    protected $table = 'defensa_tribunal';

    protected $fillable = [
        'defensa_id',
        'miembro_id',
        'tipo',
        'rol',
        'rol_tribunal_id',
    ];

    public function defensa()
    {
        return $this->belongsTo(Defensa::class, 'defensa_id');
    }
}
