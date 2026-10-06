#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    volatile int zero = 0;  // volatile: không để g++ -O2 tối ưu thành ud2 (SIGILL)
    cout << a / zero;       // chia cho 0 -> SIGFPE
}
