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
            'size': [500, 110], '$otc_diag_panel_copy': '$container_title', 'layer': 1000, 'controls': [
                {'source': label('OTC UI DIAG B | direct/copy comparison', 0)},
                {'title_heading': label('RAW TITLE (localize=false):', 10)},
                {'raw_title': label('$container_title', 20)},
                {'desktop': label('desktop=true', 30, '$desktop_screen')},
                {'pocket': label('pocket=true', 40, '$pocket_screen')},
                {'size7_yes': label('size7=true', 50, '($container_size = 7)')},
                {'size7_no': label('size7=false', 50, '(not ($container_size = 7))')},
                {'title_yes': dict(label('title-key=true', 50, "($container_title = 'container.ordertocook.stove')"), offset=[100, 50])},
                {'title_no': dict(label('title-key=false', 50, "(not ($container_title = 'container.ordertocook.stove'))"), offset=[100, 50])},
                {'copy_yes': label('panel-copy=true', 60, "($otc_diag_panel_copy = 'container.ordertocook.stove')")},
                {'copy_no': label('panel-copy=false', 60, "(not ($otc_diag_panel_copy = 'container.ordertocook.stove'))")},
                {'literal_yes': dict(label('literal=true', 60, "('container.ordertocook.stove' = 'container.ordertocook.stove')"), offset=[200, 60])},
                {'literal_no': dict(label('literal=false', 60, "(not ('container.ordertocook.stove' = 'container.ordertocook.stove'))"), offset=[200, 60])},
                {'screen_copy_yes': label('screen-copy-visible=true', 70, "($otc_diag_screen_copy = 'container.ordertocook.stove')")},
                {'screen_copy_no': label('screen-copy-visible=false', 70, "(not ($otc_diag_screen_copy = 'container.ordertocook.stove'))")},
                {'requires_copy_yes': label('screen-requires-copy=true', 80, '$otc_diag_requires_copy')},
                {'requires_copy_no': label('screen-requires-copy=false', 80, '(not $otc_diag_requires_copy)')},
                {'requires_literal_yes': label('screen-requires-literal=true', 90, '$otc_diag_requires_literal')},
                {'requires_literal_no': label('screen-requires-literal=false', 90, '(not $otc_diag_requires_literal)')},
                {'copied_title': label('$otc_diag_screen_copy', 100)}
            ]}

def modification():
    return {'array_name': 'controls', 'operation': 'insert_back',
            'value': [{KEY + '@data_driven_container.' + KEY: {}}]}

def screen_values():
    return {'$otc_diag_screen_copy': '$container_title',
            '$otc_diag_requires_copy|default': False,
            '$otc_diag_requires_literal|default': False}

def screen_cases():
    return [
        {'requires': "($otc_diag_screen_copy = 'container.ordertocook.stove')",
         '$otc_diag_requires_copy': True},
        {'requires': "('container.ordertocook.stove' = 'container.ordertocook.stove')",
         '$otc_diag_requires_literal': True}]

def apply_diagnostic(document):
    result = copy.deepcopy(document)
    if KEY in result or 'modifications' in result[SCREEN]:
        raise ValueError('Unexpected existing diagnostic/modifications; inspect before applying')
    if any(k in result[SCREEN] for k in screen_values()):
        raise ValueError('Unexpected existing comparison variables')
    result[SCREEN].update(screen_values())
    result[SCREEN]['variables'].extend(screen_cases())
    result[KEY] = diagnostic_panel()
    result[SCREEN]['modifications'] = [modification()]
    return result

def remove_diagnostic(document):
    result = copy.deepcopy(document)
    if result.get(KEY) != diagnostic_panel() or result[SCREEN].get('modifications') != [modification()]:
        raise ValueError('Diagnostic changed; refusing a broad rollback')
    if any(result[SCREEN].get(k) != v for k, v in screen_values().items()) or result[SCREEN]['variables'][-2:] != screen_cases():
        raise ValueError('Comparison variables changed; inspect before rollback')
    for k in screen_values(): del result[SCREEN][k]
    del result[SCREEN]['variables'][-2:]
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
