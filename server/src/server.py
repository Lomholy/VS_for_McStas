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

# @app.route('/getcomp')
# def get_comp():
#     data = request.get_json()
#     comp_name = data.get('comp_name', 'unknown')
#     return jsonify({"message": f"Component requested is {comp_name}"}) 

@app.route('/get_all_comps')
def hel():

    try:
        cr = ComponentReader("../../McCode/mcstas-comps", ".")
        # Loop over all components and read their info
        for comp in cr.component_category.keys():
            try:
                parsed_comp = cr.read_name(comp)
                names = parsed_comp.parameter_names
                default = parsed_comp.parameter_defaults
                unit = parsed_comp.parameter_units
                parm_type = parsed_comp.parameter_types
                parm_comment = parsed_comp.parameter_comments
                # Bunch it into a big string
                info_string = ""
                for name in names:
                    tmp = f"{parm_type[name]}: {name} [{unit[name]}] = {default[name]}  // {parm_comment[name]}\n\n"
                    info_string += tmp
                cr.component_category[comp] = info_string
            except Exception as e:
                cr.component_category[comp] = "Component information is unavailable"

        return jsonify(cr.component_category) 
    except Exception as e:
        return f"Error: {str(e)}", 500


if __name__ == "__main__":
    app.run(port=5000)
