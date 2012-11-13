/**
 * @author ant-lafarge / http://ant.lafarge.free.fr/
 */

THREE.OKMLoader = function ( showStatus ) {

	THREE.Loader.call( this, showStatus );

};

THREE.OKMLoader.prototype = Object.create( THREE.Loader.prototype );

THREE.OKMLoader.prototype.load = function ( url, callback, texturePath ) {

	var scope = this;

	texturePath = texturePath ? texturePath : this.extractUrlBase( url );

	this.onLoadStart();
	this.loadAjaxJSON( this, url, callback, texturePath );

};

THREE.OKMLoader.prototype.loadAjaxJSON = function ( context, url, callback, texturePath, callbackProgress ) {

	var xhr = new XMLHttpRequest();

	var length = 0;

	xhr.onreadystatechange = function () {

		if ( xhr.readyState === xhr.DONE ) {

			if ( xhr.status === 200 || xhr.status === 0 ) {

				if ( xhr.responseText ) {
				
					var parser = new DOMParser();
					var xml = parser.parseFromString( xhr.responseText, "text/xml" );
					context.createModel( xml, callback, texturePath );

				} else {

					console.warn( "THREE.OKMLoader: [" + url + "] seems to be unreachable or file there is empty" );

				}

				// in context of more complex asset initialization
				// do not block on single failed file
				// maybe should go even one more level up

				context.onLoadComplete();

			} else {

				console.error( "THREE.OKMLoader: Couldn't load [" + url + "] [" + xhr.status + "]" );

			}

		} else if ( xhr.readyState === xhr.LOADING ) {

			if ( callbackProgress ) {

				if ( length === 0 ) {

					length = xhr.getResponseHeader( "Content-Length" );

				}

				callbackProgress( { total: length, loaded: xhr.responseText.length } );

			}

		} else if ( xhr.readyState === xhr.HEADERS_RECEIVED ) {

			length = xhr.getResponseHeader( "Content-Length" );

		}

	};

	xhr.open( "GET", url, true );
	xhr.send( null );

};

THREE.OKMLoader.prototype.createModel = function ( xml, callback, texturePath ) {

	var xmlMaterialList = xml.querySelector( "MaterialList" );
	var xmlMaterials = xmlMaterialList.querySelectorAll( "Material" );
	var materials = [];
	for ( var i=0 ; i < xmlMaterials.length ; i++ )
	{
		materials.push( parseMaterial( xmlMaterials[i] ) );
	}

	var xmlMeshList = xml.querySelector( "MeshList" );
	var xmlMeshs = xmlMeshList.querySelectorAll( "Mesh" );
	var meshes = [];
	for ( var i=0 ; i < xmlMeshs.length ; i++ )
	{
		meshes.push( parseMesh( xmlMeshs[i] ) );
	}
	
	function getMatIdFromName( name )
	{
		for ( var i=0 ; i < materials.length ; i++ )
		{
			if ( materials[i].name == name )
			{
				return i;
			}
		}
		return -1;
	}
	
	function parseMaterial( xmlMaterial )
	{
		// MATERIAL
		var material = new THREE.MeshPhongMaterial();
		material.name = xmlMaterial.getAttribute( "Name" );
		
		var emissive = xmlMaterial.getAttribute( "Emissive" ).split(' ');
		material.emissive.r = parseFloat(emissive[0]);
		material.emissive.g = parseFloat(emissive[1]);
		material.emissive.b = parseFloat(emissive[2]);
		
		var ambient = xmlMaterial.getAttribute( "Ambient" ).split(' ');
		material.ambient.r = parseFloat(ambient[0]);
		material.ambient.g = parseFloat(ambient[1]);
		material.ambient.b = parseFloat(ambient[2]);
		
		var diffuse = xmlMaterial.getAttribute( "Diffuse" ).split(' ');
		material.color.r = parseFloat(diffuse[0]);
		material.color.g = parseFloat(diffuse[1]);
		material.color.b = parseFloat(diffuse[2]);
		
		var specular = xmlMaterial.getAttribute( "Specular" ).split(' ');
		material.specular.r = parseFloat(specular[0]);
		material.specular.g = parseFloat(specular[1]);
		material.specular.b = parseFloat(specular[2]);
		
		var tex = xmlMaterial.querySelector( "Texture" );
		if ( tex )
		{
			material.map = THREE.ImageUtils.loadTexture( texturePath + '/' + tex.getAttribute("Name") );
			//material.side = THREE.DoubleSide;
		}
		
		return material;
	}

	function parseMesh( xmlMesh )
	{
		var geometry = new THREE.Geometry();
		var material = null;
		
		geometry.name = xmlMesh.getAttribute( "Name" );
		
		var xmlSkin = xmlMesh.querySelector( "Skin" );
		var skinning = ( xmlSkin && parseFloat( xmlSkin.getAttribute( "BoneCount" ) ) > 0 ? true : false );
		// There is only 1 material per mesh
		var materialId = getMatIdFromName( xmlMesh.getAttribute( "Material" ) );
		if ( materialId === -1 )
		{
			material = new THREE.MeshNormalMaterial();
		}
		else
		{
			material = materials[ materialId ];
			geometry.materials.push( material );
			materialId = 0;
			if ( skinning )
			{
				material.skinning = true;
			}
		}
	
		// VERTICES
		var vertices = xmlMesh.querySelector( "Attribute[Name='Position']" ).getAttribute( "Data" ).split(' ');
		for ( var i=0 ; i<vertices.length ; i+=3 )
		{
			geometry.vertices.push( new THREE.Vector3( parseFloat(vertices[i]), parseFloat(vertices[i+1]), parseFloat(vertices[i+2]) ) );
		}
		
		// NORMALS
		var xmlNormal = xmlMesh.querySelector( "Attribute[Name='Normal']" );
		if ( xmlNormal )
		{
			var normals = xmlNormal.getAttribute( "Data" ).split(' ');
			geometry.normals = [];
			for ( var i=0 ; i<normals.length ; i+=3 )
			{
				geometry.normals.push( new THREE.Vector3( parseFloat(normals[i]), parseFloat(normals[i+1]), parseFloat(normals[i+2]) ) );
			}
		}
		
		// UVS
		var texcoord1 = xmlMesh.querySelector( "Attribute[Name='Texcoord1']" );
		if ( texcoord1 )
		{
			var uvs = texcoord1.getAttribute( "Data" ).split(' ');
			geometry.uvs = [];
			for ( var i=0 ; i<uvs.length ; i+=2 )
			{
				geometry.uvs.push( new THREE.UV( parseFloat(uvs[i]), 1-parseFloat(uvs[i+1]) ) );
			}
		}

		// INDICES / FACES
		var indices = null;
		var xmlIndices = xmlMesh.querySelector( "Index[Name='Default']" );
		if ( xmlIndices )
		{
			indices = xmlIndices.getAttribute( "Data" ).split(' ');
		}
		else
		{
			indices = xmlMesh.querySelector( "FaceIndex" ).getAttribute( "Data" ).split(' ');
		}
		var n = 0;
		for ( var i=0 ; i<indices.length ; i+=3 )
		{
			geometry.faces.push( new THREE.Face3( parseFloat(indices[i]), parseFloat(indices[i+1]), parseFloat(indices[i+2]), geometry.normals[n], null, materialId ) );
			if ( texcoord1 )
			{
				geometry.faceVertexUvs[0].push( [ geometry.uvs[indices[i]], geometry.uvs[indices[i+1]], geometry.uvs[indices[i+2]] ] );
			}
			n++;
		}
		
		if ( skinning )
		{
			// BONES
			parseSkin( xmlMesh.querySelector( "Skin" ), geometry );
			
			// SKININDEX
			var xmlBoneIndex = xmlMesh.querySelector( "Attribute[Name='BoneIndex']" );
			if ( xmlBoneIndex )
			{
				var bi = xmlBoneIndex.getAttribute( "Data" ).split(' ');
				for ( var i=0 ; i < bi.length ; i+=4 )
				{
					var si0 = treatSkinIndex( parseFloat(bi[0]) );
					var si1 = treatSkinIndex( parseFloat(bi[1]) );
					var si2 = treatSkinIndex( parseFloat(bi[2]) );
					var si3 = treatSkinIndex( parseFloat(bi[3]) );
					//geometry.skinIndices.push( new THREE.Vector4( si0, si1, si2, si3 ) );
					geometry.skinIndices.push( new THREE.Vector4( si0, si1, 0, 0 ) );
				}
			}
			
			// SKINWEIGHT
			var xmlBoneWeight = xmlMesh.querySelector( "Attribute[Name='BoneWeight']" );
			if ( xmlBoneWeight )
			{
				var bw = xmlBoneWeight.getAttribute( "Data" ).split(' ');
				for ( var i=0 ; i < bw.length ; i+=4 )
				{
					//geometry.skinWeights.push( new THREE.Vector4( parseFloat(bw[0]), parseFloat(bw[1]), parseFloat(bw[2]), parseFloat(bw[3]) ) );
					geometry.skinWeights.push( new THREE.Vector4( parseFloat(bw[0]), parseFloat(bw[1]), 0, 0 ) );
				}
			}
		}
		
		function treatSkinIndex( skinIndex )
		{
			if ( skinIndex == -1 )
				return 0;
			return skinIndex;
		}
		
		// Post-processing
		if ( !xmlNormal )
		{
			geometry.computeFaceNormals();
		}
		geometry.computeCentroids();
		geometry.computeBoundingBox();

		var mesh;
		if ( skinning )
		{
			mesh = new THREE.SkinnedMesh( geometry, material );
		}
		else
		{
			mesh = new THREE.Mesh( geometry, material );
		}
		mesh.name = xmlMesh.getAttribute( "Name" );
		
		return mesh;
	}
	
	function parseSkin( xmlSkin, geometry )
	{
		if ( geometry.bones == null )
			geometry.bones = [];
	
		var xmlBones = xmlSkin.querySelectorAll( "Bone" );
		
		for ( var i=0 ; i < xmlBones.length ; i++ )
		{
			var bone = {};
			bone.name = xmlBones[i].getAttribute( "Name" );
			var im = xmlBones[i].getAttribute( "InitMatrix" ).split(' ');
			//var initMatrix = new THREE.Matrix4( im[0], im[1], im[2], 0, im[3], im[4], im[5], 0, im[6], im[7], im[8], 0, im[9], im[10], im[11], 1 );
			var initMatrix = new THREE.Matrix4( im[0],im[3],im[6],im[9], im[1],im[4],im[7],im[10], im[2],im[5],im[8],im[11], 0,0,0,1 );
			//initMatrix.rotateY( Math.PI );
			bone.parent = -1;
			var pos = new THREE.Vector3();
			var rotq = new THREE.Quaternion();
			var scl = new THREE.Vector3();
			initMatrix.decompose( pos, rotq, scl );
			bone.pos = [ pos.x, pos.y, pos.z ];
			//bone.rot = [ 0, 0, 0 ];
			//bone.rotq = [ rotq.x, rotq.y, rotq.z, rotq.w ];
			bone.rotq = [ rotq.w, rotq.x, rotq.y, rotq.z ];
			//bone.scl = [ scl.x, scl.y, scl.z ];
			bone.scl = [ 1,1,1 ];
			geometry.bones.push( bone );
		}
	}
	
	var object3d = new THREE.Object3D();
	if ( meshes.length == 1 )
	{
		object3d = meshes[0];
	}
	else
	{
		object3d = new THREE.Object3D();
		for ( var i=0 ; i < meshes.length ; i++ )
		{
			object3d.add( meshes[i] );
		}
	}
	callback( object3d );
};
