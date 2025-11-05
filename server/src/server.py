import mcstasscript as ms
from mcstasscript.helper.component_reader import ComponentReader
from flask import Flask, request, jsonify
app = Flask(__name__)



@app.route('/')
def hello():
    return "Hello from Flask!"

# @app.route('/query', methods=['POST'])
# def query():
#     data = request.get_json()
#     name = data.get('name', 'unknown')
#     return jsonify({"message": f"Hello, {name}!"})

@app.route('/get_comp/<name>')
def get_comp(name):

    try:
        cr = ComponentReader("../../McCode/mcstas-comps", ".")
        comp_info = cr.read_name(name)
        return jsonify(comp_info.__dict__)
    except Exception as e:
        return f"Error: {str(e)} cr", 500



@app.route('/get_all_comps')
def get_all_comps():
    try:
        cr = ComponentReader("../../McCode/mcstas-comps", ".")
        # Loop over all components and read their info
        for comp in cr.component_category.keys():
            try:
                cr.component_category[comp] = cr.read_name(comp).__dict__
            except Exception as e:
                cr.component_category[comp] = "Component information is unavailable"

        return jsonify(cr.component_category) 
    except Exception as e:
        return f"Error: {str(e)}", 500


if __name__ == "__main__":
    app.run(port=5000)
