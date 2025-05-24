from flask import Blueprint, request, jsonify
import os
import zipfile
import tempfile
import geopandas as gpd

importar_car_bp = Blueprint('importar_car_bp', __name__)

@importar_car_bp.route('/importar_car', methods=['POST'])
def importar_car():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    file = request.files['file']
    if not file.filename.endswith('.zip'):
        return jsonify({'error': 'Arquivo deve ser .zip'}), 400

    resultados = {}
    with tempfile.TemporaryDirectory() as temp_dir:
        zip_path = os.path.join(temp_dir, 'car.zip')
        file.save(zip_path)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        # Extrair zips internos
        for root, dirs, files in os.walk(temp_dir):
            for f in files:
                if f.endswith('.zip'):
                    inner_zip_path = os.path.join(root, f)
                    extract_path = os.path.join(root, f.replace('.zip', ''))
                    with zipfile.ZipFile(inner_zip_path, 'r') as inner_zip:
                        inner_zip.extractall(extract_path)

        # Ler shapefiles
        for root, dirs, files in os.walk(temp_dir):
            for f in files:
                if f.endswith('.shp'):
                    shp_path = os.path.join(root, f)
                    try:
                        gdf = gpd.read_file(shp_path).to_crs("EPSG:4326")
                        resultados[f] = gdf.__geo_interface__
                    except Exception as e:
                        resultados[f] = {'error': str(e)}

    return jsonify(resultados)
