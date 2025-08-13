<?php
/**
* 
*/
class Main extends CI_Controller
{
	
	function __construct()
	{
		parent::__construct();
	}

	public function index()
	{
		



		if (!$this->session->userdata('username')) // si es que no se ha iniciado sesion nos retorna al login
		{
			redirect(base_url() . 'login');
		}
		// si es que no se ha iniciado sesion nos retorna al login
		if ($this->session->userdata('tipo')=="Administrador de Taller") {
			redirect(base_url() . 'economico/egresos');
		}
		$codigo_ceta='';
		

		$campos='nombre_carrera, carrera.orden, cod_pensum, pensum.orden as orden_pensum';
		$where= array('carrera.activo' =>'t','pensum.activo' =>'t');
		$ordenarpor='carrera.orden ASC, pensum.orden ASC';
		$joinTabla='pensum';
		$joinWhere='pensum.cod_carrera = carrera.cod_carrera';
		$consulta_carreras=$this->config_model->get_campos_tablas_join('carrera',$campos,$where,$ordenarpor, $joinTabla,$joinWhere); //obtenemos los pensums con carrera
		$where= array('activo' =>'t');
		$consulta_gestiones=$this->config_model->get_campos_tablas('gestion','gestion, fecha_inicio',$where,'fecha_inicio DESC'); //obtenemos las gestiones activas
		




		$data= array('titulo' => ' - Principal');
		$this->load->view("guestsistemas/head",$data); 	

		$data= array('usuario' => $this->session->userdata('username'),'onLoad'=>'onload="buscar_grupos();"');
		$this->load->view("roluser",$data);
		
		$data= array('carreras'=>$consulta_carreras, 'gestiones'=>$consulta_gestiones );

		$this->load->view("helpers");
		$this->load->view("main",$data);
		$this->load->view("guestsistemas/footer");
	}
	public function recuperar_info_certificados() {
		$gestion = $_POST['gestion'];
        echo json_encode($this->administrador_model->recuperar_info_certificados($gestion));
    }

	function grupos_carrera_gestion() 
	{
		$cod_pensum=$_POST['cod_pensum'];
		$gestion=$_POST['gestion'];
		$where= array(
			'cod_pensum' =>$cod_pensum,
			'gestion' => $gestion
		);
		$ordenarpor= 'orden_turno ASC,semestre ASC, cod_grupo ASC';
		$tabla='grupo';
		$grupos=$this->config_model->get_campos_tablas('grupo','cod_grupo',$where,$ordenarpor);

		$resultado='';
		$resultado.='';
        
        			if($grupos!=null)
            			foreach ($grupos -> result() as $fila) { 
		$resultado.= '	<option value="'.$fila->cod_grupo.'" >'.$fila->cod_grupo.'</option>'; 			
            		}

        $resultado.='';
        echo $resultado;
            	
	}

	function listar_grupos() 
	{
		$cod_pensum=$_POST['cod_pensum'];
		$gestion=$_POST['gestion'];
		$cod_grupo=$_POST['cod_grupo'];

		$where= array(
			'cod_pensum' =>$cod_pensum,
			'gestion' => $gestion
		);
		$ordenarpor= 'orden_turno ASC,semestre ASC, cod_grupo ASC';
		$tabla='grupo';
		$grupos=$this->config_model->get_campos_tablas('grupo','cod_grupo',$where,$ordenarpor);

		$resultado='';
		$resultado.='  <select class="form-control " name="cbx_gestiones" id="cbx_gestiones" >';
        
        			if($grupos!=null)
            			foreach ($grupos -> result() as $fila) { 
		$resultado.= '	<option value="'.$fila->cod_grupo.'" >'.$fila->cod_grupo.'</option>'; 			
            		}

        $resultado.='</select>';
        echo $resultado;
            	
	}
	function buscar_estudiantes($criterio)
	{
		if($criterio=='codigo')
		{
			$cod_ceta=$_POST['cod_ceta'];
			$sql=" Select estudiante.cod_ceta, ap_paterno, ap_materno, nombres, doc_presentados.numero_doc, doc_presentados.procedencia , capacitacion.procedencia as capacitacion ". 
			"FROM estudiante ".
			"LEFT JOIN doc_presentados ON doc_presentados.cod_ceta = estudiante.cod_ceta AND doc_presentados.nombre_doc = 'Carnet de identidad' ".
			"LEFT JOIN doc_presentados as capacitacion ON capacitacion.cod_ceta = estudiante.cod_ceta AND capacitacion.nombre_doc = 'Titulo de bachiller' ".
			"WHERE estudiante.cod_ceta = $cod_ceta ".
			"GROUP BY ".
			"estudiante.cod_ceta, ap_paterno, ap_materno,nombres,doc_presentados.numero_doc, doc_presentados.procedencia ,capacitacion.procedencia ".
			"ORDER BY ".
			"ap_paterno ASC, ap_materno ASC, nombres ASC";
		}
		else
		if ($criterio=='nombre')
		{
			$nombre=$_POST['nombres'];
			$appat=$_POST['ap_pat'];
			$apmat=$_POST['ap_mat'];
			$query="nombres='ninguno'";
			if (($nombre!="")&&($appat!="")&&($apmat!="")){
				$query="nombres LIKE '%$nombre%' AND ap_paterno LIKE '%$appat%' AND ap_materno LIKE '%$apmat%'";
			}
			if (($nombre!="")&&($appat!="")&&($apmat=="")){
				$query="nombres LIKE '%$nombre%' AND ap_paterno LIKE '%$appat%'";
			}
			if (($nombre!="")&&($appat=="")&&($apmat!="")){
				$query="nombres LIKE '%$nombre%' AND ap_materno LIKE '%$apmat%'";
			}
			if (($nombre!="")&&($appat=="")&&($apmat=="")){
				$query="nombres LIKE '%$nombre%'";
			}
			if (($nombre=="")&&($appat!="")&&($apmat!="")){
				$query="ap_paterno LIKE '%$appat%' AND ap_materno LIKE '%$apmat%'";
			}
			if (($nombre=="")&&($appat!="")&&($apmat=="")){
				$query="ap_paterno LIKE '%$appat%'";
			}
			if (($nombre=="")&&($appat=="")&&($apmat!="")){
				$query="ap_materno LIKE '%$apmat%'";
			}
			
			$sql=" Select estudiante.cod_ceta, ap_paterno, ap_materno, nombres, doc_presentados.numero_doc, doc_presentados.procedencia , capacitacion.procedencia as capacitacion  ". 
			"FROM estudiante ".
			"LEFT JOIN doc_presentados ON doc_presentados.cod_ceta = estudiante.cod_ceta AND doc_presentados.nombre_doc = 'Carnet de identidad' ".
			"LEFT JOIN doc_presentados as capacitacion ON capacitacion.cod_ceta = estudiante.cod_ceta AND capacitacion.nombre_doc = 'Titulo de bachiller' ".
			"WHERE $query ".
			"GROUP BY ".
			"estudiante.cod_ceta, ap_paterno, ap_materno,nombres,doc_presentados.numero_doc, doc_presentados.procedencia ,capacitacion.procedencia ".
			"ORDER BY ".
			"ap_paterno ASC, ap_materno ASC, nombres ASC";
		}
		else
		{
			$cod_pensum=$_POST['cod_pensum'];
			$gestion=$_POST['gestion'];
			$cod_grupo=$_POST['cod_grupo'];
			$sql="SELECT estudiante.cod_ceta, ap_paterno, ap_materno, nombres, doc_presentados.numero_doc, doc_presentados.procedencia , capacitacion.procedencia as capacitacion
			FROM estudiante
			LEFT JOIN doc_presentados ON doc_presentados.cod_ceta = estudiante.cod_ceta AND doc_presentados.nombre_doc = 'Carnet de identidad'
			LEFT JOIN doc_presentados as capacitacion ON capacitacion.cod_ceta = estudiante.cod_ceta AND capacitacion.nombre_doc = 'Titulo de bachiller'
			INNER JOIN registro_inscripcion ON registro_inscripcion.cod_ceta = estudiante.cod_ceta
			WHERE cod_pensum = '$cod_pensum' AND gestion = '$gestion' AND cod_curso = '$cod_grupo' AND registro_inscripcion.tipo_inscripcion = 'NORMAL'
			GROUP BY estudiante.cod_ceta, ap_paterno, ap_materno, nombres, doc_presentados.numero_doc, doc_presentados.procedencia ,capacitacion.procedencia
			ORDER BY ap_paterno ASC, ap_materno ASC, nombres ASC";

		}
		

		$resultado='';
		$contador=1;  
		$resultado.= '		<table width="100%" class="table table-fixed  table-striped table-hover table-bordered" id="dataTables-alumnos" >';
        $resultado.= '            <thead>';
        $resultado.= '                <tr >';
        $resultado.= '                    <th width="5%"></th>';
        $resultado.= '                    <th width="15%"></th>';
        $resultado.= '                    <th width="15%"></th>';
        $resultado.= '                    <th width="15%"></th>';
        $resultado.= '                    <th width="15%"></th>';
        $resultado.= '                    <th width="15%"></th>';
	    $resultado.= '                    <th width="15%"></th>';
        $resultado.= '                </tr>';
        $resultado.= '            </thead>';
        $resultado.= '            <tbody  >';

		$lista_est=$this->config_model->consulta_SQL($sql);	
		if($lista_est!=null){
            foreach ($lista_est -> result() as $fila) { 
            if($fila->capacitacion=='En trámite')
            	$estado='<span class="label label-warning">Diploma En Trámite</span>';
            else
            if($fila->capacitacion=='No tiene')
            	$estado='<span class="label label-danger">No tiene Diploma</span>';
            else $estado='';

        $resultado.= '            	<tr  class="clickable-row" id="fila'.$contador.'" onclick="click_fila(this);">';
        $resultado.= '                    <td>'.$contador.'</td>';
        $resultado.= '                    <td>'.$fila->cod_ceta.'</td>';
        $resultado.= '                    <td>'.$fila->ap_paterno.'</td>';
        $resultado.= '                    <td>'.$fila->ap_materno.'</td>';
        $resultado.= '                    <td>'.$fila->nombres.'</td>';
        $resultado.= '                    <td>'.$fila->numero_doc.'</td>';
        $resultado.= '                    <td>'.$fila->procedencia.' '.$estado.'</td>';
        $resultado.= '                </tr>';
        $contador++;
        		}
        }
        else
        {
        $resultado.= '            	<tr  class="small" >';
        $resultado.= '                    <td class="danger text-center"  colspan="7"><h4><strong>No existen datos para mostrar</strong></h4></td>';
        $resultado.= '                </tr>';
        }

    	$resultado.= '            </tbody>';
        $resultado.= '        </table>';

        echo $resultado;
		//echo $sql;
	}
	function busca_carreras()////////////////////////////////////////////////adicion para homologaciones
	{
		$cod_ceta=$_POST['cod_ceta'];

		$sql=" 
			(SELECT DISTINCT
					registro_inscripcion.cod_pensum, cod_ceta, nombre_carrera, pensum.orden
					FROM registro_inscripcion
					INNER JOIN pensum ON registro_inscripcion.cod_pensum = pensum.cod_pensum
					INNER JOIN carrera ON carrera.cod_carrera = pensum.cod_carrera
					WHERE cod_ceta = $cod_ceta
					ORDER BY pensum.orden ASC
				)
				UNION
				(SELECT DISTINCT
					registro_inscrip_homologado.cod_pensum, cod_ceta, nombre_carrera, pensum.orden
					FROM registro_inscrip_homologado
					INNER JOIN pensum ON registro_inscrip_homologado.cod_pensum = pensum.cod_pensum
					INNER JOIN carrera ON carrera.cod_carrera = pensum.cod_carrera
					WHERE cod_ceta = $cod_ceta
					ORDER BY pensum.orden ASC
			)
		
		ORDER BY orden ASC";
		$resultado='';
		$resultado.= '';
		$carreras=$this->config_model->consulta_SQL($sql);	
		if($carreras!=null){
            foreach ($carreras -> result() as $fila) { 
        				$resultado.= '<option value="'.$fila->cod_pensum.'" >'.$fila->nombre_carrera.' ('.$fila->cod_pensum.')</option>';             				
         			}
         		}
        $resultado.= '';
        echo $resultado;
	}

	function cargar_gestion_est()		////////////////////////////////////////////////adicion para homologaciones
	{
		$cod_ceta=$_POST['cod_ceta'];
		$cod_pensum=$_POST['cod_pensum'];

		$sql="  (
				SELECT DISTINCT registro_inscripcion.gestion, fecha_inicio
				FROM registro_inscripcion
				INNER JOIN gestion ON gestion.gestion = registro_inscripcion.gestion
				WHERE cod_ceta = $cod_ceta AND cod_pensum = '$cod_pensum'
				ORDER BY fecha_inicio DESC
				)
				UNION
				(		SELECT DISTINCT registro_inscrip_homologado.gestion, fecha_inicio
				FROM registro_inscrip_homologado
				INNER JOIN gestion ON gestion.gestion = registro_inscrip_homologado.gestion
				WHERE cod_ceta = $cod_ceta AND cod_pensum = '$cod_pensum'
				ORDER BY fecha_inicio DESC
				)
				ORDER BY fecha_inicio DESC";

		$resultado='';
		$resultado.= '';
		$gestiones=$this->config_model->consulta_SQL($sql);	
		//echo $lista_est
		if($gestiones!=null){
            foreach ($gestiones -> result() as $fila) { 
        				$resultado.= '<option value="'.$fila->gestion.'" >'.$fila->gestion.'</option>';             				
         			}
         		}
             
        $resultado.= '';
        echo $resultado;
	}
	function cargar_gestion_est_autoselect() {
		$cod_ceta = $_POST['cod_ceta'];
		$cod_pensum = $_POST['cod_pensum'];
		$gestion_busqueda = $_POST['gestion_busqueda'];

		$sql="  SELECT DISTINCT registro_inscripcion.gestion, fecha_inicio
				FROM registro_inscripcion
				INNER JOIN gestion ON gestion.gestion = registro_inscripcion.gestion
				WHERE cod_ceta = $cod_ceta AND cod_pensum = '$cod_pensum'
				ORDER BY fecha_inicio DESC";

		$resultado='';
		// $resultado.= '			<select class="form-control "  id="gestion" >';
		$gestiones=$this->config_model->consulta_SQL($sql);	
		//echo $lista_est
		if($gestiones!=null){
            foreach ($gestiones -> result() as $fila) {
				if($fila->gestion == $gestion_busqueda) {
					$resultado.= '<option value="'.$fila->gestion.'" selected >'.$fila->gestion.'</option>';
				} else {
					$resultado.= '<option value="'.$fila->gestion.'" >'.$fila->gestion.'</option>';
				}
			}
        }
             
        // $resultado.= '		    </select>';
        echo $resultado;
	}
	function cargar_tipo_inscrp_est()		////////////////////////////////////////////////adicion para homologaciones
	{
		$cod_ceta=$_POST['cod_ceta'];
		$cod_pensum=$_POST['cod_pensum'];
		$gestion=$_POST['gestion'];

		$sql=" ( SELECT tipo_inscripcion, 0 as orden
				FROM registro_inscripcion
				WHERE cod_ceta = $cod_ceta AND cod_pensum = '$cod_pensum'AND gestion='$gestion'
				ORDER BY tipo_inscripcion DESC)
				UNION
				(SELECT 'Homologado' as tipo_inscripcion,1 as orden
				FROM registro_inscrip_homologado
				WHERE cod_ceta = $cod_ceta AND cod_pensum = '$cod_pensum'AND gestion='$gestion'
				ORDER BY tipo_inscripcion DESC)
				ORDER BY orden, tipo_inscripcion DESC";

		$resultado='';
		$resultado.= '';
		$tipo_insc=$this->config_model->consulta_SQL($sql);	
		//echo $lista_est
		if($tipo_insc!=null){
            foreach ($tipo_insc -> result() as $fila) { 
        				$resultado.= '<option value="'.$fila->tipo_inscripcion.'" >'.$fila->tipo_inscripcion.'</option>';             				
         			}
         		}
             
        $resultado.= '';
        echo $resultado;
	}

	function cargar_grupo_est()
	{
		$cod_ceta=$_POST['cod_ceta'];
		$cod_pensum=$_POST['cod_pensum'];
		$gestion=$_POST['gestion'];
		$tipo_inscripcion=$_POST['tipo_inscripcion'];
		$resultado = "";
		if($tipo_inscripcion=="Homologado")
			{
				$resultado.= '';
	        	$resultado.= '<option value="SIN DATO" >SIN DATO</option>';             				
	            $resultado.= '';
	        echo $resultado;
			}
		else
		{
			$sql="  SELECT cod_curso
					FROM registro_inscripcion
					WHERE cod_ceta = $cod_ceta AND cod_pensum = '$cod_pensum'AND gestion='$gestion' AND tipo_inscripcion= '$tipo_inscripcion'";

			$resultado='';
			$resultado.= '';
			$grupo_est=$this->config_model->consulta_SQL($sql);	
			if($grupo_est!=null){
	            foreach ($grupo_est -> result() as $fila) { 
	        				$resultado.= '<option value="'.$fila->cod_curso.'" >'.$fila->cod_curso.'</option>';             				
	         			}
	         		}
	             
	        $resultado.= '';
	        echo $resultado;
		}
		
	}

function buscar_estudiantes_por_cod()
	{
		$cod_ceta=$_POST['cod_ceta'];
		
		
		
		$sql=" Select estudiante.cod_ceta, ap_paterno, ap_materno, nombres, numero_doc, procedencia ". 
		"FROM estudiante ".
		"LEFT JOIN doc_presentados ON doc_presentados.cod_ceta = estudiante.cod_ceta AND doc_presentados.nombre_doc = 'Carnet de identidad' ".
		"WHERE estudiante.cod_ceta = $cod_ceta ".
		"GROUP BY ".
		"estudiante.cod_ceta, ap_paterno, ap_materno,nombres,numero_doc, procedencia ".
		"ORDER BY ".
		"ap_paterno ASC, ap_materno ASC, nombres ASC";

		$resultado='';
		$contador=1;  
		$resultado.= '		<table width="100%" class="table table-striped table-hover table-bordered" id="dataTables-alumnos">';
        $resultado.= '            <thead>';
        $resultado.= '                <tr class="info">';
        $resultado.= '                    <th>Nº</th>';
        $resultado.= '                    <th>Cod. CETA</th>';
        $resultado.= '                    <th>Ap. Paterno</th>';
        $resultado.= '                    <th>Ap. Materno</th>';
        $resultado.= '                    <th>Nombres</th>';
        $resultado.= '                    <th>Cédula de Identidad</th>';
	    $resultado.= '                    <th>Procedencia</th>';
	    $resultado.= '                    <th></th>';
	    $resultado.= '                    <th></th>';
        $resultado.= '                </tr>';
        $resultado.= '            </thead>';
        $resultado.= '            <tbody>';

		$lista_est=$this->config_model->consulta_SQL($sql);	
		if($lista_est!=null){
            foreach ($lista_est -> result() as $fila) { 
        $resultado.= '            	<tr  class="small" >';
        $resultado.= '                    <td>'.$contador.'</td>';
        $resultado.= '                    <td>'.$fila->cod_ceta.'</td>';
        $resultado.= '                    <td>'.$fila->ap_paterno.'</td>';
        $resultado.= '                    <td>'.$fila->ap_materno.'</td>';
        $resultado.= '                    <td>'.$fila->nombres.'</td>';
        $resultado.= '                    <td>'.$fila->numero_doc.'</td>';
        $resultado.= '                    <td>'.$fila->procedencia.'</td>';
        $resultado.= '                </tr>';
        $contador++;
        		}
        }
        else
        {
        $resultado.= '            	<tr  class="small" >';
        $resultado.= '                    <td>No existen datos para mostrar</td>';
        $resultado.= '                </tr>';
        }

    	$resultado.= '            </tbody>';
        $resultado.= '        </table>';

        echo $resultado;
		//echo $sql;
	}


	
}


?>