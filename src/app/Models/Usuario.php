<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;

class Usuario extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Nombre de la tabla
     */
    protected $table = 'usuario';

    /**
     * Deshabilitar timestamps automáticos de Laravel
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'nombre_usuario',
        'contrasena',
        'email',
        'rol_id',
        'activo',
        'fecha_creacion',
        'fecha_actualizacion',
        'fecha_bloqueo',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'contrasena',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'activo' => 'boolean',
        'fecha_creacion' => 'datetime',
        'fecha_actualizacion' => 'datetime',
        'fecha_bloqueo' => 'datetime',
    ];

    /**
     * Obtener el nombre del campo de contraseña para autenticación
     */
    public function getAuthPassword()
    {
        return $this->contrasena;
    }

    /**
     * Obtener el nombre del campo de usuario para autenticación
     */
    public function getAuthIdentifierName()
    {
        return 'email'; // o 'nombre_usuario' si prefieres usar el username
    }

    /**
     * Relación con el rol
     */
    public function rol()
    {
        return $this->belongsTo(Rol::class, 'rol_id');
    }

    /**
     * Obtener todos los permisos del usuario a través de su rol
     */
    public function permisos()
    {
        return $this->rol ? $this->rol->permisos : collect();
    }

    /**
     * Verificar si el usuario tiene un rol específico
     */
    public function tieneRol($nombreRol)
    {
        return $this->rol && $this->rol->nombre === $nombreRol && $this->rol->activo;
    }

    /**
     * Verificar si el usuario tiene alguno de los roles especificados
     */
    public function tieneAlgunRol(array $roles)
    {
        return $this->rol && in_array($this->rol->nombre, $roles) && $this->rol->activo;
    }

    /**
     * Verificar si el usuario tiene un permiso específico
     */
    public function tienePermiso($codigoPermiso)
    {
        return $this->rol && $this->rol->tienePermiso($codigoPermiso);
    }

    /**
     * Verificar si el usuario tiene alguno de los permisos especificados
     */
    public function tieneAlgunPermiso(array $codigosPermisos)
    {
        return $this->rol && $this->rol->tieneAlgunPermiso($codigosPermisos);
    }

    /**
     * Verificar si el usuario tiene todos los permisos especificados
     */
    public function tieneTodosLosPermisos(array $codigosPermisos)
    {
        return $this->rol && $this->rol->tieneTodosLosPermisos($codigosPermisos);
    }

    /**
     * Asignar un rol al usuario
     */
    public function asignarRol($rolId)
    {
        $this->update(['rol_id' => $rolId]);
    }

    /**
     * Bloquear usuario temporalmente
     */
    public function bloquear()
    {
        $this->update([
            'fecha_bloqueo' => now(),
            'activo' => false
        ]);
    }

    /**
     * Desbloquear usuario
     */
    public function desbloquear()
    {
        $this->update([
            'fecha_bloqueo' => null,
            'activo' => true
        ]);
    }

    /**
     * Verificar si el usuario está bloqueado
     */
    public function estaBloqueado()
    {
        return !is_null($this->fecha_bloqueo) || !$this->activo;
    }

    /**
     * Scope para usuarios activos
     */
    public function scopeActivo($query)
    {
        return $query->where('activo', true);
    }

    /**
     * Scope para filtrar por rol
     */
    public function scopePorRol($query, $nombreRol)
    {
        return $query->whereHas('rol', function ($q) use ($nombreRol) {
            $q->where('nombre', $nombreRol);
        });
    }

    /**
     * Scope para buscar usuarios
     */
    public function scopeBuscar($query, $termino)
    {
        return $query->where(function ($q) use ($termino) {
            $q->where('nombre_usuario', 'like', "%{$termino}%")
              ->orWhere('email', 'like', "%{$termino}%");
        });
    }

    /**
     * Mutator para encriptar la contraseña
     */
    public function setContrasenaAttribute($value)
    {
        if ($value) {
            $this->attributes['contrasena'] = Hash::make($value);
        }
    }

    /**
     * Actualizar fecha de actualización automáticamente
     */
    protected static function boot()
    {
        parent::boot();

        static::updating(function ($usuario) {
            $usuario->fecha_actualizacion = now();
        });
    }
}
