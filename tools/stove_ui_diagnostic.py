#!/usr/bin/env python3
"""Temporary staging-only UI tracing. No inventory/gameplay changes."""
import argparse
import copy
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
KEY = 'otc_ui_diagnostic_a'
SCREEN = 'screen@common.inventory_screen_common'

def diagnostic_panel():
    def label(text, y, visible=True):
        return {'type': 'label', 'text': text, 'localize': False,
                'anchor_from': 'top_left', 'anchor_to': 'top_left',
                'offset': [0, y], 'size': [320, 10], 'color': [1, 1, 0],
                'shadow': True, 'text_alignment': 'left', 'visible': visible}
    return {'type': 'panel', 'anchor_from': 'bottom_left',
            'anchor_to': 'bottom_left', 'offset': [4, -4],
            'size': [320, 60], 'layer': 1000, 'controls': [
                {'source': label('OTC UI DIAG A | data_driven.screen', 0)},
                {'title_heading': label('RAW TITLE (localize=false):', 10)},
                {'raw_title': label('$container_title', 20)},
                {'desktop': label('desktop=true', 30, '$desktop_screen')},
                {'pocket': label('pocket=true', 40, '$pocket_screen')},
                {'size7_yes': label('size7=true', 50, '($container_size = 7)')},
                {'size7_no': label('size7=false', 50, '(not ($container_size = 7))')},
                {'title_yes': dict(label('title-key=true', 50, "($container_title = 'container.ordertocook.stove')"), offset=[100, 50])},
                {'title_no': dict(label('title-key=false', 50, "(not ($container_title = 'container.ordertocook.stove'))"), offset=[100, 50])}
            ]}

def modification():
    return {'array_name': 'controls', 'operation': 'insert_back',
            'value': [{KEY + '@data_driven_container.' + KEY: {}}]}

def apply_diagnostic(document):
    result = copy.deepcopy(document)
    if KEY in result or 'modifications' in result[SCREEN]:
        raise ValueError('Unexpected existing diagnostic/modifications; inspect before applying')
    result[KEY] = diagnostic_panel()
    result[SCREEN]['modifications'] = [modification()]
    return result

def remove_diagnostic(document):
    result = copy.deepcopy(document)
    if result.get(KEY) != diagnostic_panel() or result[SCREEN].get('modifications') != [modification()]:
        raise ValueError('Diagnostic changed; refusing a broad rollback')
    del result[KEY]
    del result[SCREEN]['modifications']
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remove', action='store_true')
    parser.add_argument('--path', type=Path, default=ROOT / 'runtime/RP/ui/data_driven_container_screen.json')
    args = parser.parse_args()
    before = json.loads(args.path.read_text())
    after = remove_diagnostic(before) if args.remove else apply_diagnostic(before)
    args.path.write_text(json.dumps(after, indent=2) + '\n')

if __name__ == '__main__':
    main()
