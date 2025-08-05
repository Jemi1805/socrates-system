CREATE TABLE `rol` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(255),
  `descripcion` text,
  `nivel_acceso` int,
  `fecha_creacion` timestamp DEFAULT (now()),
  `activo` boolean DEFAULT true
);

CREATE TABLE `permiso` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `codigo` varchar(255),
  `nombre` varchar(255),
  `descripcion` text
);

CREATE TABLE `rol_permiso` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `rol_id` int,
  `permiso_id` int,
  `concedido` boolean DEFAULT true
);

CREATE TABLE `usuario` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `nombre_usuario` varchar(255) UNIQUE NOT NULL,
  `contrasena` varchar(255) NOT NULL COMMENT 'Almacenar hash',
  `email` varchar(255) UNIQUE NOT NULL,
  `rol_id` int NOT NULL,
  `activo` boolean DEFAULT true,
  `fecha_creacion` timestamp DEFAULT (now()),
  `fecha_actualizacion` timestamp COMMENT 'Actualizar con trigger',
  `fecha_bloqueo` datetime COMMENT 'Para bloqueo temporal por intentos'
);

CREATE TABLE `postulante` (
  `cod_ceta` int PRIMARY KEY AUTO_INCREMENT,
  `nombres_est` varchar(255) NOT NULL,
  `apellidos_est` varchar(255) NOT NULL,
  `ci` varchar(255) NOT NULL,
  `expedido` varchar(255),
  `celular` varchar(255),
  `reg_ini_c` varchar(255),
  `gestion_ini` varchar(255),
  `reg_con_c` varchar(255),
  `gestion_fin` varchar(255),
  `incrip_uni` boolean DEFAULT false
);

CREATE TABLE `carrera` (
  `cod_carrera` int PRIMARY KEY AUTO_INCREMENT,
  `nom_carrera` varchar(255),
  `num_materias` int
);

CREATE TABLE `postulante_carrera` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `cod_carrera` int,
  `cod_ceta` int
);

CREATE TABLE `aranceles_est` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `cod_ceta_est` int,
  `concepto` varchar(255),
  `monto` decimal,
  `pagado` boolean,
  `fecha_pago` date
);

CREATE TABLE `pract_ind` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `empresa` varchar(255),
  `fecha_inicio` date,
  `fecha_fin` date,
  `descripcion` text,
  `estado` varchar(255)
);

CREATE TABLE `modalidad` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(255),
  `descripcion` text
);

CREATE TABLE `proyecto` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `modalidad_id` int,
  `nombre` varchar(255),
  `tipo` varchar(255),
  `objetivo` text,
  `estado` varchar(255) DEFAULT 'En progreso',
  `porcentaje_avance` int DEFAULT 0
);

CREATE TABLE `inscrip_modalidad` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `cod_ceta_est` int,
  `modalidad_id` int,
  `pract_ind_id` int UNIQUE,
  `aranceles_id` int,
  `fecha_inscripcion` date,
  `estado` varchar(255)
);

CREATE TABLE `diploma_bachiller` (
  `nro_serie` varchar(255) PRIMARY KEY AUTO_INCREMENT,
  `id_doc_req` int,
  `emision` varchar(255),
  `fecha_emision` date,
  `observación` text,
  `gestion_bachiller` int
);

CREATE TABLE `ra_homol_ex` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `id_doc_req` int,
  `nro_res` varchar(255),
  `fecha_emision` date
);

CREATE TABLE `grado_homol` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `homologacion_id` int,
  `grado_sec` varchar(255),
  `gestion_sec` int
);

CREATE TABLE `transitabilidad_edu_reg` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `id_doc_req` int,
  `serie_titulo_tm` varchar(255),
  `numero_titulo_tm` varchar(255),
  `fecha_emision` date
);

CREATE TABLE `transitabilidad_inst_tec` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `id_doc_req` int,
  `serie_titulo_tm` varchar(255),
  `numero_titulo_tm` varchar(255),
  `fecha_emision` date
);

CREATE TABLE `traspasos_instituto` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `id_doc_req` int,
  `instituto_origen` varchar(255),
  `grados_cursados` varchar(255),
  `gestiones_cursadas` varchar(255)
);

CREATE TABLE `grados_trasp` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `traspaso_id` int,
  `grado` varchar(255),
  `gestion` int
);

CREATE TABLE `res_homol_cp` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `id_doc_req` int,
  `nro_res` varchar(255),
  `fecha_emision` date,
  `grados_cursados` varchar(255),
  `gestiones_cursadas` varchar(255)
);

CREATE TABLE `grados_homol_cp` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `homol_cp_id` int,
  `grado` varchar(255),
  `gestion` int
);

CREATE TABLE `documentos_requeridos` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `nombre_doc` varchar(255) NOT NULL,
  `obligatorio` boolean DEFAULT true
);

CREATE TABLE `documentos_adjuntos` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `inscripcion_id` int,
  `tipo_doc_id` int,
  `archivo_pdf` varchar(255),
  `fecha_subida` timestamp DEFAULT (now()),
  `validado` boolean,
  `usuario_validador` int,
  `fecha_validacion` datetime,
  `observaciones` text
);

CREATE TABLE `tutores` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(255),
  `profesion` varchar(255),
  `especialidad` varchar(255),
  `email` varchar(255),
  `telefono` varchar(255),
  `honorarios` decimal
);

CREATE TABLE `designacion_tutor` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `proyecto_id` int,
  `tutor_id` int,
  `fecha_designacion` date,
  `archivo_memorandum` varchar(255)
);

CREATE TABLE `tribunales` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(255),
  `interno` boolean,
  `cargo` varchar(255),
  `email` varchar(255)
);

CREATE TABLE `designacion_tribunal` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `proyecto_id` int,
  `tribunal_id` int,
  `fecha_designacion` date,
  `rol` varchar(255)
);

CREATE TABLE `defensas` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `proyecto_id` int,
  `fecha` date NOT NULL,
  `hora` time NOT NULL,
  `lugar` varchar(255) NOT NULL,
  `estado` varchar(255) DEFAULT 'Programada',
  `modalidad_evaluacion` varchar(255) COMMENT 'Virtual/Presencial',
  `enlace_virtual` varchar(255) COMMENT 'Si es virtual'
);

CREATE TABLE `calif_def` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `defensa_id` int,
  `tribunal_id` int,
  `nota` decimal,
  `observacion` text
);

CREATE TABLE `actas_defensa` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `defensa_id` int,
  `archivo_pdf` varchar(255),
  `puntaje_final` decimal,
  `fecha_generacion` date,
  `firmada` boolean
);

CREATE TABLE `tramites_titulacion` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `estudiante_id` int,
  `fecha_inicio` date,
  `archivador_generado` boolean,
  `estado` varchar(255),
  `observaciones` text
);

CREATE TABLE `requisitos_titulacion` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(255),
  `obligatorio` boolean
);

CREATE TABLE `documentos_titulacion` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `tramite_id` int,
  `requisito_id` int,
  `archivo_pdf` varchar(255),
  `fecha_subida` date,
  `validado` boolean
);

CREATE TABLE `historial_tramite` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `tramite_id` int,
  `fecha` date,
  `descripcion` TEXT,
  `usuario_responsable` varchar(255)
);

CREATE TABLE `certificado_egreso` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `estudiante_id` int,
  `fecha_emision` date,
  `archivo_pdf` varchar(255)
);

CREATE TABLE `titulo_profesional` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `estudiante_id` int,
  `fecha_emision` date,
  `archivo_pdf` varchar(255)
);

CREATE TABLE `entrega_titulo` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `titulo_id` int,
  `entregado_a` varchar(255),
  `fecha_entrega` DATE,
  `recibido_por` varchar(255)
);

CREATE TABLE `legalizaciones_titulo` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `titulo_id` int,
  `fecha` DATE,
  `motivo` varchar(255),
  `observaciones` text
);

CREATE UNIQUE INDEX `rol_permiso_index_0` ON `rol_permiso` (`rol_id`, `permiso_id`);

CREATE UNIQUE INDEX `usuario_index_1` ON `usuario` (`email`);

CREATE UNIQUE INDEX `usuario_index_2` ON `usuario` (`nombre_usuario`);

ALTER TABLE `rol_permiso` ADD FOREIGN KEY (`rol_id`) REFERENCES `rol` (`id`);

ALTER TABLE `rol_permiso` ADD FOREIGN KEY (`permiso_id`) REFERENCES `permiso` (`id`);

ALTER TABLE `usuario` ADD FOREIGN KEY (`rol_id`) REFERENCES `rol` (`id`);

ALTER TABLE `postulante_carrera` ADD FOREIGN KEY (`cod_carrera`) REFERENCES `carrera` (`cod_carrera`);

ALTER TABLE `postulante_carrera` ADD FOREIGN KEY (`cod_ceta`) REFERENCES `postulante` (`cod_ceta`);

ALTER TABLE `aranceles_est` ADD FOREIGN KEY (`cod_ceta_est`) REFERENCES `postulante` (`cod_ceta`);

ALTER TABLE `proyecto` ADD FOREIGN KEY (`modalidad_id`) REFERENCES `modalidad` (`id`);

ALTER TABLE `inscrip_modalidad` ADD FOREIGN KEY (`cod_ceta_est`) REFERENCES `postulante` (`cod_ceta`);

ALTER TABLE `inscrip_modalidad` ADD FOREIGN KEY (`modalidad_id`) REFERENCES `modalidad` (`id`);

ALTER TABLE `inscrip_modalidad` ADD FOREIGN KEY (`pract_ind_id`) REFERENCES `pract_ind` (`id`);

ALTER TABLE `inscrip_modalidad` ADD FOREIGN KEY (`aranceles_id`) REFERENCES `aranceles_est` (`id`);

ALTER TABLE `diploma_bachiller` ADD FOREIGN KEY (`id_doc_req`) REFERENCES `documentos_requeridos` (`id`);

ALTER TABLE `ra_homol_ex` ADD FOREIGN KEY (`id_doc_req`) REFERENCES `documentos_requeridos` (`id`);

ALTER TABLE `grado_homol` ADD FOREIGN KEY (`homologacion_id`) REFERENCES `ra_homol_ex` (`id`);

ALTER TABLE `transitabilidad_edu_reg` ADD FOREIGN KEY (`id_doc_req`) REFERENCES `documentos_requeridos` (`id`);

ALTER TABLE `transitabilidad_inst_tec` ADD FOREIGN KEY (`id_doc_req`) REFERENCES `documentos_requeridos` (`id`);

ALTER TABLE `traspasos_instituto` ADD FOREIGN KEY (`id_doc_req`) REFERENCES `documentos_requeridos` (`id`);

ALTER TABLE `grados_trasp` ADD FOREIGN KEY (`traspaso_id`) REFERENCES `traspasos_instituto` (`id`);

ALTER TABLE `res_homol_cp` ADD FOREIGN KEY (`id_doc_req`) REFERENCES `documentos_requeridos` (`id`);

ALTER TABLE `grados_homol_cp` ADD FOREIGN KEY (`homol_cp_id`) REFERENCES `res_homol_cp` (`id`);

ALTER TABLE `documentos_adjuntos` ADD FOREIGN KEY (`inscripcion_id`) REFERENCES `inscrip_modalidad` (`id`);

ALTER TABLE `documentos_adjuntos` ADD FOREIGN KEY (`tipo_doc_id`) REFERENCES `documentos_requeridos` (`id`);

ALTER TABLE `documentos_adjuntos` ADD FOREIGN KEY (`usuario_validador`) REFERENCES `usuario` (`id`);

ALTER TABLE `designacion_tutor` ADD FOREIGN KEY (`proyecto_id`) REFERENCES `proyecto` (`id`);

ALTER TABLE `designacion_tutor` ADD FOREIGN KEY (`tutor_id`) REFERENCES `tutores` (`id`);

ALTER TABLE `designacion_tribunal` ADD FOREIGN KEY (`proyecto_id`) REFERENCES `proyecto` (`id`);

ALTER TABLE `designacion_tribunal` ADD FOREIGN KEY (`tribunal_id`) REFERENCES `tribunales` (`id`);

ALTER TABLE `defensas` ADD FOREIGN KEY (`proyecto_id`) REFERENCES `proyecto` (`id`);

ALTER TABLE `calif_def` ADD FOREIGN KEY (`defensa_id`) REFERENCES `defensas` (`id`);

ALTER TABLE `calif_def` ADD FOREIGN KEY (`tribunal_id`) REFERENCES `tribunales` (`id`);

ALTER TABLE `actas_defensa` ADD FOREIGN KEY (`defensa_id`) REFERENCES `defensas` (`id`);

ALTER TABLE `tramites_titulacion` ADD FOREIGN KEY (`estudiante_id`) REFERENCES `postulante` (`cod_ceta`);

ALTER TABLE `documentos_titulacion` ADD FOREIGN KEY (`tramite_id`) REFERENCES `tramites_titulacion` (`id`);

ALTER TABLE `documentos_titulacion` ADD FOREIGN KEY (`requisito_id`) REFERENCES `requisitos_titulacion` (`id`);

ALTER TABLE `historial_tramite` ADD FOREIGN KEY (`tramite_id`) REFERENCES `tramites_titulacion` (`id`);

ALTER TABLE `certificado_egreso` ADD FOREIGN KEY (`estudiante_id`) REFERENCES `postulante` (`cod_ceta`);

ALTER TABLE `titulo_profesional` ADD FOREIGN KEY (`estudiante_id`) REFERENCES `postulante` (`cod_ceta`);

ALTER TABLE `entrega_titulo` ADD FOREIGN KEY (`titulo_id`) REFERENCES `titulo_profesional` (`id`);

ALTER TABLE `legalizaciones_titulo` ADD FOREIGN KEY (`titulo_id`) REFERENCES `titulo_profesional` (`id`);
