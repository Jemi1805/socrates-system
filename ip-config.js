// Archivo de configuracion central para la IP del sistema
const HOST_IP = '192.168.0.78';

module.exports = {
  HOST_IP: HOST_IP,
  API_URL: 'http://' + HOST_IP + ':8080/api',
  FRONTEND_URL: 'http://' + HOST_IP + ':4200',
  PHPMYADMIN_URL: 'http://' + HOST_IP + ':8090',
  LARAVEL_URL: 'http://' + HOST_IP + ':8080'
};
