import struct
import json
import os

def merge_gltf_animation(char_path, anim_path, out_path):
    # 1. Read Character GLB
    with open(char_path, 'rb') as f:
        magic, ver, total_len = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67, "Invalid GLTF magic"
        
        # Read JSON chunk
        json_len, json_type = struct.unpack('<II', f.read(8))
        char_json = json.loads(f.read(json_len).decode('utf-8'))
        
        # Read BIN chunk (if any)
        char_bin = b''
        if f.tell() < total_len:
            bin_len, bin_type = struct.unpack('<II', f.read(8))
            char_bin = f.read(bin_len)
            
    # 2. Read Animation GLB
    with open(anim_path, 'rb') as f:
        magic, ver, total_len = struct.unpack('<III', f.read(12))
        json_len, json_type = struct.unpack('<II', f.read(8))
        anim_json = json.loads(f.read(json_len).decode('utf-8'))
        
        anim_bin = b''
        if f.tell() < total_len:
            bin_len, bin_type = struct.unpack('<II', f.read(8))
            anim_bin = f.read(bin_len)
            
    print(f"Character BIN size: {len(char_bin)} bytes")
    print(f"Animation BIN size: {len(anim_bin)} bytes")
    
    # 3. Align char_bin to 4-byte boundary
    pad_char = (4 - (len(char_bin) % 4)) % 4
    char_bin += b'\x00' * pad_char
    bin_offset_base = len(char_bin)
    
    # 4. Offset animation bufferViews
    # In anim_json, all bufferViews refer to buffer 0
    buffer_views_base = len(char_json.get('bufferViews', []))
    accessors_base = len(char_json.get('accessors', []))
    
    # Check if char_json has bufferViews
    if 'bufferViews' not in char_json:
        char_json['bufferViews'] = []
    if 'accessors' not in char_json:
        char_json['accessors'] = []
        
    for bv in anim_json.get('bufferViews', []):
        new_bv = dict(bv)
        new_bv['buffer'] = 0
        new_bv['byteOffset'] = new_bv.get('byteOffset', 0) + bin_offset_base
        char_json['bufferViews'].append(new_bv)
        
    for acc in anim_json.get('accessors', []):
        new_acc = dict(acc)
        if 'bufferView' in new_acc:
            new_acc['bufferView'] = new_acc['bufferView'] + buffer_views_base
        char_json['accessors'].append(new_acc)
        
    # Remap animation samplers accessors
    char_json['animations'] = []
    for anim in anim_json.get('animations', []):
        new_anim = {
            'name': anim.get('name', 'Running_Motion'),
            'samplers': [],
            'channels': []
        }
        for s in anim.get('samplers', []):
            new_s = dict(s)
            new_s['input'] = new_s['input'] + accessors_base
            new_s['output'] = new_s['output'] + accessors_base
            new_anim['samplers'].append(new_s)
            
        for c in anim.get('channels', []):
            new_c = {
                'sampler': c['sampler'],
                'target': dict(c['target'])
            }
            new_anim['channels'].append(new_c)
            
        char_json['animations'].append(new_anim)
        
    # 5. Combined binary buffer
    combined_bin = char_bin + anim_bin
    pad_final = (4 - (len(combined_bin) % 4)) % 4
    combined_bin += b'\x00' * pad_final
    
    char_json['buffers'][0]['byteLength'] = len(combined_bin)
    
    # 6. Encode JSON
    json_bytes = json.dumps(char_json, separators=(',', ':')).encode('utf-8')
    pad_json = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b' ' * pad_json
    
    # 7. Write Output GLB
    total_file_size = 12 + 8 + len(json_bytes) + 8 + len(combined_bin)
    with open(out_path, 'wb') as f:
        # GLB Header
        f.write(struct.pack('<III', 0x46546C67, 2, total_file_size))
        # JSON Chunk
        f.write(struct.pack('<II', len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        # BIN Chunk
        f.write(struct.pack('<II', len(combined_bin), 0x004E4942))
        f.write(combined_bin)
        
    print(f"SUCCESS: Arquivo mesclado gerado: {out_path} ({total_file_size} bytes)")
    return True

if __name__ == '__main__':
    c_path = r'd:\AUTO FLUXO VDEOS\Character_output.glb'
    a_path = r'd:\AUTO FLUXO VDEOS\Animation_Running_withSkin.glb'
    out_path = r'd:\AUTO FLUXO VDEOS\Character_Running_Complete.glb'
    merge_gltf_animation(c_path, a_path, out_path)
