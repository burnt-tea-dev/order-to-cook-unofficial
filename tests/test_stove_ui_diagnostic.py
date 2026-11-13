import copy
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
scope = {'__file__': str(ROOT / 'tools/stove_ui_diagnostic.py'), '__name__': 'diagnostic_under_test'}
exec(compile((ROOT / 'tools/stove_ui_diagnostic.py').read_text(), 'stove_ui_diagnostic.py', 'exec'), scope)

class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.current = json.loads((ROOT / 'runtime/RP/ui/data_driven_container_screen.json').read_text())
        self.base = scope['remove_diagnostic'](self.current)
    def test_exact_apply_remove_roundtrip(self):
        self.assertEqual(scope['apply_diagnostic'](self.base), self.current)
        self.assertEqual(scope['remove_diagnostic'](scope['apply_diagnostic'](self.base)), self.base)
    def test_only_decorative_controls(self):
        def visit(node):
            if isinstance(node, dict):
                if 'type' in node: self.assertIn(node['type'], ('label', 'panel'))
                for forbidden in ('bindings', 'button_mappings', 'collection_name', 'grid_item_template', 'factory'):
                    self.assertNotIn(forbidden, node)
                for value in node.values(): visit(value)
            elif isinstance(node, list):
                for value in node: visit(value)
        visit(self.current[scope['KEY']])
    def test_raw_title_not_localized(self):
        labels = self.current[scope['KEY']]['controls']
        raw = next(item['raw_title'] for item in labels if 'raw_title' in item)
        self.assertEqual(raw['text'], '$container_title')
        self.assertFalse(raw['localize'])
    def test_reapply_refused(self):
        with self.assertRaises(ValueError): scope['apply_diagnostic'](self.current)
    def test_changed_diagnostic_rollback_refused(self):
        changed = copy.deepcopy(self.current)
        changed[scope['KEY']]['layer'] = 4
        with self.assertRaises(ValueError): scope['remove_diagnostic'](changed)
    def test_route_matrix_is_exclusive_and_identity_safe(self):
        for desktop in (False, True):
            for size in (5, 7, 9, 27, 54):
                for title in ('container.ordertocook.stove', 'other.seven.slot', 'Stove', '炉灶', ''):
                    chosen = []
                    for b in self.current[scope['SCREEN']]['variables']:
                        e = b['requires'].replace(' = ', ' == ')
                        for k, v in {'$desktop_screen':desktop, '$pocket_screen':not desktop,
                                     '$container_size':size, '$container_title':title}.items():
                            e = e.replace(k, repr(v))
                        if eval(e, {'__builtins__':{}}, {}): chosen.append(b['$screen_content'])
                    self.assertEqual(len(chosen), 1)
                    self.assertEqual('otc_stove' in chosen[0], size == 7 and title == 'container.ordertocook.stove')

if __name__ == '__main__': unittest.main()
