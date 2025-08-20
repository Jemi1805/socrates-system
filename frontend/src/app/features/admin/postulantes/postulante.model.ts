export interface Postulante {
  cod_ceta: number;
  nombres_est: string;
  apellidos_est: string;
  ci: string;
  expedido: string;
  ci_completo: string; // Nuevo campo para CI completo
  celular: string;
  carrera: string;
  reg_ini_c: string;
  gestion_ini: string;
  reg_con_c: string;
  gestion_fin: string;
  incrip_uni: boolean;
}