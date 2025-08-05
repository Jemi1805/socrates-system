<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rol extends Model
{
    use HasFactory;

    /**
     * Nombre de la tabla
     */
    protected $table = 'rol';

    /**
     * Deshabilitar timestamps automáticos de Laravel
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'nombre',
        'descripcion',
        'nivel_acceso',
        'fecha_creacion',
        'activo',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'activo' => 'boolean',
        'fecha_creacion' => 'datetime',
        'nivel_acceso' => 'integer',
    ];

    /**
     * Relación con permisos (muchos a muchos)
     */
    public function permisos()
    {
        return $this->belongsToMany(Permiso::class, 'rol_permiso', 'rol_id', 'permiso_id')
                    ->withPivot('concedido')
                    ->wherePivot('concedido', true);
    }

    /**
     * Relación con usuarios
     */
    public function usuarios()
    {
        return $this->hasMany(Usuario::class, 'rol_id');
    }

    /**
     * Verificar si el rol tiene un permiso específico
     */
    public function tienePermiso($codigoPermiso)
    {
        return $this->permisos()
                    ->where('codigo', $codigoPermiso)
                    ->exists();
    }

    /**
     * Verificar si el rol tiene alguno de los permisos especificados
     */
    public function tieneAlgunPermiso(array $codigosPermisos)
    {
        return $this->permisos()
                    ->whereIn('codigo', $codigosPermisos)
                    ->exists();
    }

    /**
     * Verificar si el rol tiene todos los permisos especificados
     */
    public function tieneTodosLosPermisos(array $codigosPermisos)
    {
        $permisosRol = $this->permisos()
                           ->whereIn('codigo', $codigosPermisos)
                           ->pluck('codigo')
                           ->toArray();

        return count($codigosPermisos) === count($permisosRol);
    }

    /**
     * Asignar permisos al rol
     */
    public function asignarPermisos(array $permisoIds)
    {
        $syncData = [];
        foreach ($permisoIds as $permisoId) {
            $syncData[$permisoId] = ['concedido' => true];
        }
        $this->permisos()->sync($syncData);
    }

    /**
     * Agregar un permiso al rol
     */
    public function darPermiso($permisoId)
    {
        if (!$this->permisos()->where('permiso_id', $permisoId)->exists()) {
            $this->permisos()->attach($permisoId, ['concedido' => true]);
        }
    }

    /**
     * Remover un permiso del rol
     */
    public function revocarPermiso($permisoId)
    {
        $this->permisos()->detach($permisoId);
    }

    /**
     * Scope para roles activos
     */
    public function scopeActivo($query)
    {
        return $query->where('activo', true);
    }

    /**
     * Scope para buscar por nombre
     */
    public function scopePorNombre($query, $nombre)
    {
        return $query->where('nombre', 'like', "%{$nombre}%");
    }

    /**
     * Scope para filtrar por nivel de acceso
     */
    public function scopePorNivelAcceso($query, $nivel)
    {
        return $query->where('nivel_acceso', $nivel);
    }

    /**
     * Obtener roles ordenados por nivel de acceso
     */
    public function scopeOrdenadosPorNivel($query)
    {
        return $query->orderBy('nivel_acceso', 'desc');
    }
}
