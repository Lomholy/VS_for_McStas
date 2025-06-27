# parse_comp.py
import sys
import json
import re
from mcstasscript.helper.component_reader import ComponentReader
import os
def parse_comp_file(component, mcstas_path, output_path):
    cr = ComponentReader(mcstas_path, ".") # 
    comp = component.rsplit('/', 1)[-1]
    comp = comp.rsplit('.',1)[0]
    comp_info = cr.read_name(comp)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(comp_info.__dict__, f)
    return


if __name__ == '__main__':
    file_path = sys.argv[1]
    mcstas_path = sys.argv[2]
    output_path = sys.argv[3] 
    result = parse_comp_file(file_path, mcstas_path, output_path)



