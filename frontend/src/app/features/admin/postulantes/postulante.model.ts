export interface Postulante {
  cod_ceta: number;
  nombres_est: string;
  ap_pat: string;
  ap_mat: string;
  ci: string;
  procedencia: string;
  ci_completo: string; // Nuevo campo para CI completo
  fecha_nacimiento: string;
  lugar_nacimiento: string;
  celular: string;
  carrera: string;
  pensum: string;
  reg_ini_c: string;
  gestion_ini: string;
  reg_con_c: string;
  gestion_fin: string;
  incrip_uni: boolean;
  nro_serie_titulo: string;
}