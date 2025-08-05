<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permiso extends Model
{
    use HasFactory;

    /**
     * Nombre de la tabla
     */
    protected $table = 'permiso';

    /**
     * Deshabilitar timestamps automáticos de Laravel
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'codigo',
        'nombre',
        'descripcion',
    ];

    /**
     * Relación con roles (muchos a muchos)
     */
    public function roles()
    {
        return $this->belongsToMany(Rol::class, 'rol_permiso', 'permiso_id', 'rol_id')
                    ->withPivot('concedido')
                    ->wherePivot('concedido', true);
    }

    /**
     * Scope para buscar por código
     */
    public function scopePorCodigo($query, $codigo)
    {
        return $query->where('codigo', $codigo);
    }

    /**
     * Scope para buscar por nombre
     */
    public function scopePorNombre($query, $nombre)
    {
        return $query->where('nombre', 'like', "%{$nombre}%");
    }

    /**
     * Obtener permisos agrupados por módulo (basado en el código)
     */
    public static function agrupadosPorModulo()
    {
        return self::orderBy('codigo')
                   ->get()
                   ->groupBy(function ($permiso) {
                       // Agrupar por la primera parte del código (antes del punto)
                       $partes = explode('.', $permiso->codigo);
                       return isset($partes[0]) ? $partes[0] : 'general';
                   });
    }

    /**
     * Crear permisos CRUD para un módulo
     */
    public static function crearPermisosCrud($modulo, $nombreModulo)
    {
        $acciones = [
            'crear' => 'Crear',
            'leer' => 'Ver',
            'actualizar' => 'Editar',
            'eliminar' => 'Eliminar'
        ];

        $permisos = [];

        foreach ($acciones as $accion => $nombreAccion) {
            $permiso = self::create([
                'codigo' => strtolower($modulo) . '.' . $accion,
                'nombre' => "{$nombreAccion} {$nombreModulo}",
                'descripcion' => "Permite {$nombreAccion} {$nombreModulo}",
            ]);

            $permisos[] = $permiso;
        }

        return $permisos;
    }

    /**
     * Verificar si un código de permiso existe
     */
    public static function existeCodigo($codigo)
    {
        return self::where('codigo', $codigo)->exists();
    }

    /**
     * Obtener permiso por código
     */
    public static function porCodigo($codigo)
    {
        return self::where('codigo', $codigo)->first();
    }
}
