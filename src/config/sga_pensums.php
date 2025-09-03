<?php

return [
    // Listas por defecto (puede sobreescribirse por .env)
    'mecanica' => array_values(array_filter(array_map('trim', explode(',', env('PENSUMS_MECANICA', 'Plan vigente,Plan anterior'))))),
    'electricidad' => array_values(array_filter(array_map('trim', explode(',', env('PENSUMS_ELECTRICIDAD', 'Plan vigente,Plan anterior'))))),
    'default' => array_values(array_filter(array_map('trim', explode(',', env('PENSUMS_DEFAULT', 'Plan vigente,Plan anterior'))))),
];
