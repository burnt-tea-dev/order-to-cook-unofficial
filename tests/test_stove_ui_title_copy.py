import ast
import copy
import hashlib
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / 'runtime/RP/ui/data_driven_container_screen.json'
SCREEN = 'screen@common.inventory_screen_common'
BASE_HASH = 'f2bda88378f3011ddd38c51131f030e0f2b89afd37edccb6c045715363589b9d'
class TitleCopyTests(unittest.TestCase):
    def setUp(self):
        self.ui = json.loads(UI.read_text())
        self.screen = self.ui[SCREEN]
    def test_exact_engine_copy(self):
        self.assertEqual(self.screen['$otc_title_copy'], '$container_title')
    def test_four_guards_use_copy_and_size(self):
        self.assertEqual(len(self.screen['variables']), 4)
        for branch in self.screen['variables']:
            condition = branch['requires']
            self.assertIn("($otc_title_copy = 'container.ordertocook.stove')", condition)
            self.assertIn('($container_size = 7)', condition)
            self.assertNotIn('$container_title', condition)
    def test_reverting_alias_restores_exact_production_ui(self):
        restored = copy.deepcopy(self.ui)
        del restored[SCREEN]['$otc_title_copy']
        for branch in restored[SCREEN]['variables']:
            branch['requires'] = branch['requires'].replace('$otc_title_copy', '$container_title')
        canonical = (json.dumps(restored, indent=2) + '\n').encode()
        self.assertEqual(hashlib.sha256(canonical).hexdigest(), BASE_HASH)
    def test_diagnostics_removed(self):
        self.assertNotIn('modifications', self.screen)
        self.assertNotIn('controls', self.screen)
        self.assertNotIn('otc_ui_diagnostic', UI.read_text())
        self.assertNotIn('otc_diag', UI.read_text())
        self.assertFalse((ROOT/'tools/stove_ui_diagnostic.py').exists())
        self.assertFalse((ROOT/'tests/test_stove_ui_diagnostic.py').exists())
    def test_native_slot_indices_unchanged(self):
        grid = self.ui['otc_stove_slots']
        self.assertEqual(grid['collection_name'], 'container_items')
        self.assertEqual(grid['grid_dimensions'], [7, 1])
        for i, item in enumerate(grid['controls']):
            self.assertEqual(item['slot_'+str(i)]['grid_position'], [i, 0])
    def test_route_contract_50_cases_not_engine_emulation(self):
        for desktop in (False, True):
            for size in (5, 7, 9, 27, 54):
                for title in ('container.ordertocook.stove', 'other.seven.slot', 'Stove', '炉灶', ''):
                    chosen = []
                    for branch in self.screen['variables']:
                        expr = branch['requires'].replace(' = ', ' == ')
                        for k, v in {'$desktop_screen': desktop, '$pocket_screen': not desktop,
                                     '$container_size': size, '$otc_title_copy': title}.items():
                            expr = expr.replace(k, repr(v))
                        if eval(expr, {'__builtins__': {}}, {}): chosen.append(branch['$screen_content'])
                    self.assertEqual(len(chosen), 1)
                    self.assertEqual('otc_stove' in chosen[0], size == 7 and title == 'container.ordertocook.stove')
    def test_generator_reproduces_three_ui_files(self):
        tree = ast.parse((ROOT/'tools/convert_assets.py').read_text())
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'make_stove_ui')
        outputs = {}
        class FakePath:
            def __init__(self, value): self.value = value
            def __truediv__(self, value): return FakePath(self.value+'/'+value)
            def unlink(self, **kwargs): pass
        scope = {'RP': FakePath('runtime/RP'), 'NS': 'ordertocook',
                 'write_json': lambda path, obj: outputs.update({path.value: obj})}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'generator', 'exec'), scope)
        scope['make_stove_ui']()
        self.assertEqual(len(outputs), 3)
        for path, value in outputs.items(): self.assertEqual(json.loads((ROOT/path).read_text()), value)
if __name__ == '__main__': unittest.main()
