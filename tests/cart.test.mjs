import test from 'node:test';
import assert from 'node:assert/strict';
import {readCart,addCartItem} from '../frontend/src/lib/cart.ts';
test('carrinho malformado é recuperado com segurança',()=>{for(const input of ['invalid','null','{}','[null,4,{}]'])assert.deepEqual(readCart(input),[])});
test('somente IDs persistem, valores enviados pelo navegador são descartados',()=>{assert.deepEqual(readCart('[{"productId":"p","variantId":"v","priceCents":1}]'),[{productId:'p',variantId:'v'}])});
test('mesmo formato não duplica, formatos diferentes podem coexistir',()=>{const a={productId:'p',variantId:'mp3'},b={productId:'p',variantId:'wav'};assert.deepEqual(addCartItem(addCartItem([a],a),b),[a,b]);assert.deepEqual(readCart(JSON.stringify([a,a,b])),[a,b])});
