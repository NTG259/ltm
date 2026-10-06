#include <vector>
#include <iostream>
using namespace std;

int main() {
    vector<long long> v(400000000LL, 1); // ~3.2 GB > 256 MB
    cout << v[0];
}
